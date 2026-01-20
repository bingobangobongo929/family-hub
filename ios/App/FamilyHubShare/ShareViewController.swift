import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers
import UserNotifications

/// Share Extension for Family Hub
/// Allows users to share photos and text from other apps to add calendar events or tasks
class ShareViewController: UIViewController {

    // MARK: - Properties
    private var sharedItems: [SharedItem] = []
    private let maxImageSize: Int = 5 * 1024 * 1024 // 5MB

    private lazy var containerView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor.systemBackground
        view.layer.cornerRadius = 20
        view.layer.shadowColor = UIColor.black.cgColor
        view.layer.shadowOffset = CGSize(width: 0, height: -2)
        view.layer.shadowOpacity = 0.1
        view.layer.shadowRadius = 10
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private lazy var dragIndicator: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor.systemGray4
        view.layer.cornerRadius = 2.5
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.text = "Add to Family Hub"
        label.font = .systemFont(ofSize: 20, weight: .bold)
        label.textColor = .label
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var previewImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 12
        imageView.backgroundColor = .secondarySystemBackground
        imageView.isHidden = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()

    private lazy var textPreviewLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 14)
        label.textColor = .secondaryLabel
        label.numberOfLines = 3
        label.textAlignment = .center
        label.isHidden = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var buttonsStackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 12
        stack.distribution = .fillEqually
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()

    private lazy var taskButton: UIButton = {
        let button = UIButton(type: .system)
        button.backgroundColor = UIColor(red: 0.08, green: 0.72, blue: 0.65, alpha: 1.0) // Teal
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        button.layer.cornerRadius = 14
        button.addTarget(self, action: #selector(taskButtonTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false

        // Icon + Text
        var config = UIButton.Configuration.filled()
        config.title = "Add Task"
        config.image = UIImage(systemName: "checkmark.circle.fill")
        config.imagePadding = 8
        config.baseBackgroundColor = UIColor(red: 0.08, green: 0.72, blue: 0.65, alpha: 1.0)
        config.baseForegroundColor = .white
        config.cornerStyle = .large
        button.configuration = config

        return button
    }()

    private lazy var calendarButton: UIButton = {
        let button = UIButton(type: .system)
        button.backgroundColor = UIColor.systemBlue
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        button.layer.cornerRadius = 14
        button.addTarget(self, action: #selector(calendarButtonTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false

        // Icon + Text
        var config = UIButton.Configuration.filled()
        config.title = "Scan Calendar"
        config.image = UIImage(systemName: "calendar.badge.plus")
        config.imagePadding = 8
        config.baseBackgroundColor = .systemBlue
        config.baseForegroundColor = .white
        config.cornerStyle = .large
        button.configuration = config

        return button
    }()

    private lazy var cancelButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Cancel", for: .normal)
        button.setTitleColor(.secondaryLabel, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 15)
        button.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    private lazy var activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        indicator.translatesAutoresizingMaskIntoConstraints = false
        return indicator
    }()

    private lazy var successCheckmark: UIImageView = {
        let imageView = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
        imageView.tintColor = UIColor(red: 0.08, green: 0.72, blue: 0.65, alpha: 1.0)
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.isHidden = true
        return imageView
    }()

    private lazy var statusLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15, weight: .medium)
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        label.isHidden = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        requestNotificationPermission()
        extractSharedContent()
    }

    // MARK: - UI Setup
    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)

        view.addSubview(containerView)
        containerView.addSubview(dragIndicator)
        containerView.addSubview(titleLabel)
        containerView.addSubview(previewImageView)
        containerView.addSubview(textPreviewLabel)
        containerView.addSubview(buttonsStackView)
        containerView.addSubview(cancelButton)
        containerView.addSubview(activityIndicator)
        containerView.addSubview(successCheckmark)
        containerView.addSubview(statusLabel)

        buttonsStackView.addArrangedSubview(taskButton)
        buttonsStackView.addArrangedSubview(calendarButton)

        NSLayoutConstraint.activate([
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            dragIndicator.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 8),
            dragIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            dragIndicator.widthAnchor.constraint(equalToConstant: 36),
            dragIndicator.heightAnchor.constraint(equalToConstant: 5),

            titleLabel.topAnchor.constraint(equalTo: dragIndicator.bottomAnchor, constant: 16),
            titleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),

            previewImageView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 16),
            previewImageView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            previewImageView.widthAnchor.constraint(equalToConstant: 120),
            previewImageView.heightAnchor.constraint(equalToConstant: 90),

            textPreviewLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 16),
            textPreviewLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 24),
            textPreviewLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -24),

            buttonsStackView.topAnchor.constraint(equalTo: previewImageView.bottomAnchor, constant: 20),
            buttonsStackView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            buttonsStackView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            buttonsStackView.heightAnchor.constraint(equalToConstant: 56),

            cancelButton.topAnchor.constraint(equalTo: buttonsStackView.bottomAnchor, constant: 12),
            cancelButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            cancelButton.bottomAnchor.constraint(equalTo: containerView.safeAreaLayoutGuide.bottomAnchor, constant: -16),

            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: buttonsStackView.centerYAnchor),

            successCheckmark.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            successCheckmark.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 30),
            successCheckmark.widthAnchor.constraint(equalToConstant: 64),
            successCheckmark.heightAnchor.constraint(equalToConstant: 64),

            statusLabel.topAnchor.constraint(equalTo: successCheckmark.bottomAnchor, constant: 12),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
        ])
    }

    // MARK: - Notifications
    private func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                print("[ShareExtension] Notification permission error: \(error)")
            }
        }
    }

    private func sendProcessingNotification(forTask: Bool) {
        let content = UNMutableNotificationContent()
        content.title = "Processing..."
        content.body = forTask ? "Creating task from your shared content" : "Scanning for calendar events"
        content.sound = nil
        content.categoryIdentifier = "PROCESSING"

        let request = UNNotificationRequest(
            identifier: "familyhub-processing",
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("[ShareExtension] Failed to send notification: \(error)")
            }
        }
    }

    // MARK: - Content Extraction
    private func extractSharedContent() {
        activityIndicator.startAnimating()

        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            showError("No content to share")
            return
        }

        let group = DispatchGroup()

        for attachment in attachments {
            group.enter()

            // Check for image
            if attachment.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] item, error in
                    defer { group.leave() }

                    if let url = item as? URL {
                        self?.processImageURL(url)
                    } else if let image = item as? UIImage {
                        self?.processImage(image)
                    } else if let data = item as? Data {
                        if let image = UIImage(data: data) {
                            self?.processImage(image)
                        }
                    }
                }
            }
            // Check for text
            else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, error in
                    defer { group.leave() }

                    if let text = item as? String {
                        self?.processText(text)
                    }
                }
            }
            // Check for URL
            else if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
                    defer { group.leave() }

                    if let url = item as? URL {
                        self?.processURL(url)
                    }
                }
            } else {
                group.leave()
            }
        }

        group.notify(queue: .main) { [weak self] in
            self?.activityIndicator.stopAnimating()
            self?.updatePreview()
        }
    }

    private func processImageURL(_ url: URL) {
        guard let data = try? Data(contentsOf: url),
              let image = UIImage(data: data) else { return }
        processImage(image)
    }

    private func processImage(_ image: UIImage) {
        var imageData = image.jpegData(compressionQuality: 0.8)

        if let data = imageData, data.count > maxImageSize {
            imageData = image.jpegData(compressionQuality: 0.5)
        }

        guard let finalData = imageData else { return }

        let base64 = "data:image/jpeg;base64," + finalData.base64EncodedString()

        DispatchQueue.main.async { [weak self] in
            self?.sharedItems.append(.image(image: image, base64: base64))
            self?.previewImageView.image = image
            self?.previewImageView.isHidden = false
            self?.textPreviewLabel.isHidden = true
        }
    }

    private func processText(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            self?.sharedItems.append(.text(text))
            // Truncate for preview
            let previewText = text.count > 150 ? String(text.prefix(147)) + "..." : text
            self?.textPreviewLabel.text = "\"\(previewText)\""
            self?.textPreviewLabel.isHidden = false
            self?.previewImageView.isHidden = true
        }
    }

    private func processURL(_ url: URL) {
        processText(url.absoluteString)
    }

    private func updatePreview() {
        if sharedItems.isEmpty {
            showError("Could not process shared content")
            return
        }

        // Enable both buttons - user chooses
        taskButton.isEnabled = true
        calendarButton.isEnabled = true
    }

    private func showError(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            self?.activityIndicator.stopAnimating()
            self?.titleLabel.text = message
            self?.taskButton.isEnabled = false
            self?.calendarButton.isEnabled = false
        }
    }

    // MARK: - Actions
    @objc private func cancelTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    @objc private func taskButtonTapped() {
        processWithIntent(isTask: true)
    }

    @objc private func calendarButtonTapped() {
        processWithIntent(isTask: false)
    }

    private func processWithIntent(isTask: Bool) {
        // Disable buttons
        taskButton.isEnabled = false
        calendarButton.isEnabled = false
        buttonsStackView.isHidden = true
        cancelButton.isHidden = true

        // Show processing state
        activityIndicator.startAnimating()
        titleLabel.text = isTask ? "Adding Task..." : "Scanning Calendar..."

        // Save to App Group with intent
        saveToAppGroup(intent: isTask ? "task" : "calendar")

        // Send processing notification
        sendProcessingNotification(forTask: isTask)

        // Brief delay for visual feedback, then open app
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.showSuccessAndOpenApp(isTask: isTask)
        }
    }

    private func saveToAppGroup(intent: String) {
        guard let defaults = UserDefaults(suiteName: "group.app.familyhub.home") else { return }

        var sharedData: [String: Any] = [
            "timestamp": Date().timeIntervalSince1970,
            "intent": intent  // "task" or "calendar"
        ]

        for (index, item) in sharedItems.enumerated() {
            switch item {
            case .text(let text):
                sharedData["text_\(index)"] = text
            case .image(_, let base64):
                sharedData["image_\(index)"] = base64
            }
        }

        sharedData["itemCount"] = sharedItems.count

        defaults.set(sharedData, forKey: "shared_content")
        defaults.synchronize()
    }

    private func showSuccessAndOpenApp(isTask: Bool) {
        activityIndicator.stopAnimating()

        // Show success state
        UIView.animate(withDuration: 0.3) { [weak self] in
            self?.previewImageView.isHidden = true
            self?.textPreviewLabel.isHidden = true
            self?.successCheckmark.isHidden = false
            self?.successCheckmark.transform = CGAffineTransform(scaleX: 0.5, y: 0.5)
            self?.statusLabel.isHidden = false
            self?.statusLabel.text = "Processing in background..."
        } completion: { [weak self] _ in
            UIView.animate(withDuration: 0.2, delay: 0, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.5) {
                self?.successCheckmark.transform = .identity
            }
        }

        titleLabel.text = "Sent!"

        // Open app after brief delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            self?.openMainApp(isTask: isTask)
        }
    }

    private func openMainApp(isTask: Bool) {
        // Use a single deep link with intent parameter
        let urlString = "familyhub://process?intent=\(isTask ? "task" : "calendar")"

        guard let url = URL(string: urlString) else {
            closeExtension()
            return
        }

        if #available(iOS 16.0, *) {
            extensionContext?.open(url) { [weak self] success in
                self?.closeExtension()
            }
        } else {
            closeExtension()
        }
    }

    private func closeExtension() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
}

// MARK: - Shared Item Type
enum SharedItem {
    case text(String)
    case image(image: UIImage, base64: String)
}
