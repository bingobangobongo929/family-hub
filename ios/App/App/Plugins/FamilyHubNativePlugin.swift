import Foundation
import Capacitor
import UIKit
import VisionKit
import Speech
import AVFoundation

/// Native plugin for Family Hub providing iOS-specific features
@objc(FamilyHubNativePlugin)
public class FamilyHubNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FamilyHubNativePlugin"
    public let jsName = "FamilyHubNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openDocumentScanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openPhotoLibrary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openCamera", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startVoiceRecognition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopVoiceRecognition", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkVoicePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestVoicePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSharedContent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSharedContent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkReduceMotion", returnType: CAPPluginReturnPromise),
    ]

    // MARK: - Document Scanner
    private var documentScannerCall: CAPPluginCall?

    @objc func openDocumentScanner(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("Document scanning is not supported on this device")
            return
        }

        documentScannerCall = call

        DispatchQueue.main.async { [weak self] in
            let scannerVC = VNDocumentCameraViewController()
            scannerVC.delegate = self
            self?.bridge?.viewController?.present(scannerVC, animated: true)
        }
    }

    // MARK: - Photo Library
    private var photoPickerCall: CAPPluginCall?

    @objc func openPhotoLibrary(_ call: CAPPluginCall) {
        let multiple = call.getBool("multiple") ?? false

        photoPickerCall = call

        DispatchQueue.main.async { [weak self] in
            var config = PHPickerConfiguration()
            config.selectionLimit = multiple ? 10 : 1
            config.filter = .images

            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self?.bridge?.viewController?.present(picker, animated: true)
        }
    }

    // MARK: - Camera
    private var cameraCall: CAPPluginCall?

    @objc func openCamera(_ call: CAPPluginCall) {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            call.reject("Camera is not available")
            return
        }

        cameraCall = call

        DispatchQueue.main.async { [weak self] in
            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.delegate = self
            picker.allowsEditing = false
            self?.bridge?.viewController?.present(picker, animated: true)
        }
    }

    // MARK: - Voice Recognition
    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var audioEngine: AVAudioEngine?
    private var voiceCall: CAPPluginCall?
    private var lastTranscription: String = ""

    @objc func checkVoicePermission(_ call: CAPPluginCall) {
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        let micStatus = AVAudioSession.sharedInstance().recordPermission

        call.resolve([
            "speech": speechStatus == .authorized,
            "microphone": micStatus == .granted
        ])
    }

    @objc func requestVoicePermission(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
            if speechStatus == .authorized {
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        call.resolve([
                            "speech": speechStatus == .authorized,
                            "microphone": granted
                        ])
                    }
                }
            } else {
                DispatchQueue.main.async {
                    call.resolve([
                        "speech": false,
                        "microphone": false
                    ])
                }
            }
        }
    }

    @objc func startVoiceRecognition(_ call: CAPPluginCall) {
        let locale = call.getString("locale") ?? "en-US"

        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)),
              recognizer.isAvailable else {
            call.reject("Speech recognition not available")
            return
        }

        voiceCall = call
        speechRecognizer = recognizer
        audioEngine = AVAudioEngine()
        lastTranscription = ""

        do {
            // Configure audio session
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let recognitionRequest = recognitionRequest else {
                call.reject("Unable to create recognition request")
                return
            }

            recognitionRequest.shouldReportPartialResults = true

            let inputNode = audioEngine?.inputNode
            guard let inputNode = inputNode else {
                call.reject("Audio engine has no input node")
                return
            }

            recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
                if let result = result {
                    self?.lastTranscription = result.bestTranscription.formattedString

                    // Send partial results
                    self?.notifyListeners("voicePartialResult", data: [
                        "text": result.bestTranscription.formattedString,
                        "isFinal": result.isFinal
                    ])

                    if result.isFinal {
                        self?.stopRecognitionInternal()
                        self?.voiceCall?.resolve([
                            "text": result.bestTranscription.formattedString,
                            "isFinal": true
                        ])
                    }
                }

                if error != nil {
                    self?.stopRecognitionInternal()
                }
            }

            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
                self.recognitionRequest?.append(buffer)
            }

            audioEngine?.prepare()
            try audioEngine?.start()

        } catch {
            call.reject("Failed to start voice recognition: \(error.localizedDescription)")
        }
    }

    @objc func stopVoiceRecognition(_ call: CAPPluginCall) {
        stopRecognitionInternal()
        call.resolve([
            "text": lastTranscription
        ])
    }

    private func stopRecognitionInternal() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()

        recognitionRequest = nil
        recognitionTask = nil

        try? AVAudioSession.sharedInstance().setActive(false)
    }

    // MARK: - Shared Content (from Share Extension)
    @objc func getSharedContent(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: "group.app.familyhub.home"),
              let sharedData = defaults.dictionary(forKey: "shared_content") else {
            call.resolve(["hasContent": false])
            return
        }

        // Check if content is recent (within last 5 minutes)
        if let timestamp = sharedData["timestamp"] as? TimeInterval {
            let age = Date().timeIntervalSince1970 - timestamp
            if age > 300 { // 5 minutes
                defaults.removeObject(forKey: "shared_content")
                call.resolve(["hasContent": false])
                return
            }
        }

        var result: [String: Any] = ["hasContent": true]
        var images: [String] = []
        var texts: [String] = []

        let itemCount = sharedData["itemCount"] as? Int ?? 0
        for i in 0..<itemCount {
            if let text = sharedData["text_\(i)"] as? String {
                texts.append(text)
            }
            if let image = sharedData["image_\(i)"] as? String {
                images.append(image)
            }
        }

        result["images"] = images
        result["texts"] = texts

        call.resolve(result)
    }

    @objc func clearSharedContent(_ call: CAPPluginCall) {
        guard let defaults = UserDefaults(suiteName: "group.app.familyhub.home") else {
            call.resolve()
            return
        }

        defaults.removeObject(forKey: "shared_content")
        defaults.synchronize()
        call.resolve()
    }

    // MARK: - Accessibility
    @objc func checkReduceMotion(_ call: CAPPluginCall) {
        let reduceMotion = UIAccessibility.isReduceMotionEnabled
        call.resolve(["reduceMotion": reduceMotion])
    }
}

// MARK: - Document Scanner Delegate
extension FamilyHubNativePlugin: VNDocumentCameraViewControllerDelegate {
    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        controller.dismiss(animated: true)

        var images: [[String: Any]] = []

        for i in 0..<scan.pageCount {
            let image = scan.imageOfPage(at: i)
            if let data = image.jpegData(compressionQuality: 0.8) {
                let base64 = "data:image/jpeg;base64," + data.base64EncodedString()
                images.append([
                    "index": i,
                    "base64": base64,
                    "width": image.size.width,
                    "height": image.size.height
                ])
            }
        }

        documentScannerCall?.resolve([
            "images": images,
            "pageCount": scan.pageCount
        ])
        documentScannerCall = nil
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        documentScannerCall?.reject("Scanner cancelled")
        documentScannerCall = nil
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        controller.dismiss(animated: true)
        documentScannerCall?.reject("Scanner failed: \(error.localizedDescription)")
        documentScannerCall = nil
    }
}

// MARK: - Photo Picker Delegate
import PhotosUI

extension FamilyHubNativePlugin: PHPickerViewControllerDelegate {
    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        if results.isEmpty {
            photoPickerCall?.reject("No images selected")
            photoPickerCall = nil
            return
        }

        var images: [[String: Any]] = []
        let group = DispatchGroup()

        for (index, result) in results.enumerated() {
            group.enter()

            result.itemProvider.loadObject(ofClass: UIImage.self) { [weak self] object, error in
                defer { group.leave() }

                if let image = object as? UIImage,
                   let data = image.jpegData(compressionQuality: 0.8) {
                    let base64 = "data:image/jpeg;base64," + data.base64EncodedString()
                    images.append([
                        "index": index,
                        "base64": base64,
                        "width": image.size.width,
                        "height": image.size.height
                    ])
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            self?.photoPickerCall?.resolve([
                "images": images
            ])
            self?.photoPickerCall = nil
        }
    }
}

// MARK: - Camera Delegate
extension FamilyHubNativePlugin: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)

        guard let image = info[.originalImage] as? UIImage,
              let data = image.jpegData(compressionQuality: 0.8) else {
            cameraCall?.reject("Failed to capture image")
            cameraCall = nil
            return
        }

        let base64 = "data:image/jpeg;base64," + data.base64EncodedString()

        cameraCall?.resolve([
            "image": [
                "base64": base64,
                "width": image.size.width,
                "height": image.size.height
            ]
        ])
        cameraCall = nil
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        cameraCall?.reject("Camera cancelled")
        cameraCall = nil
    }
}
