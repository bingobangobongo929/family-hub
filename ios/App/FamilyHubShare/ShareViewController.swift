import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

/// Share Extension for Family Hub
/// Allows users to share photos and text from other apps to add calendar events
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

    private lazy var headerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.text = "Add to Family Hub"
        label.font = .systemFont(ofSize: 17, weight: .semibold)
        label.textColor = .label
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var cancelButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Cancel", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17)
        button.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    private lazy var addButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Scan with AI", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        button.setTitleColor(UIColor(red: 0.08, green: 0.72, blue: 0.65, alpha: 1.0), for: .normal) // Teal
        button.addTarget(self, action: #selector(addTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()

    private lazy var previewImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 12
        imageView.backgroundColor = .secondarySystemBackground
        imageView.isHidden = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()

    private lazy var textPreviewLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15)
        label.textColor = .secondaryLabel
        label.numberOfLines = 5
        label.isHidden = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var infoLabel: UILabel = {
        let label = UILabel()
        label.text = "This will open Family Hub to scan and create calendar events"
        label.font = .systemFont(ofSize: 13)
        label.textColor = .tertiaryLabel
        label.numberOfLines = 0
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        indicator.translatesAutoresizingMaskIntoConstraints = false
        return indicator
    }()

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractSharedContent()
    }

    // MARK: - UI Setup
    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)

        view.addSubview(containerView)
        containerView.addSubview(headerView)
        headerView.addSubview(cancelButton)
        headerView.addSubview(titleLabel)
        headerView.addSubview(addButton)
        containerView.addSubview(previewImageView)
        containerView.addSubview(textPreviewLabel)
        containerView.addSubview(infoLabel)
        containerView.addSubview(activityIndicator)

        NSLayoutConstraint.activate([
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            containerView.heightAnchor.constraint(greaterThanOrEqualToConstant: 300),

            headerView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 16),
            headerView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            headerView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            headerView.heightAnchor.constraint(equalToConstant: 44),

            cancelButton.leadingAnchor.constraint(equalTo: headerView.leadingAnchor),
            cancelButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            titleLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            addButton.trailingAnchor.constraint(equalTo: headerView.trailingAnchor),
            addButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            previewImageView.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 20),
            previewImageView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            previewImageView.widthAnchor.constraint(equalToConstant: 200),
            previewImageView.heightAnchor.constraint(equalToConstant: 150),

            textPreviewLabel.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 20),
            textPreviewLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            textPreviewLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),

            infoLabel.topAnchor.constraint(equalTo: previewImageView.bottomAnchor, constant: 20),
            infoLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            infoLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            infoLabel.bottomAnchor.constraint(lessThanOrEqualTo: containerView.safeAreaLayoutGuide.bottomAnchor, constant: -20),

            activityIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: previewImageView.centerYAnchor),
        ])
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
        // Compress if needed
        var imageData = image.jpegData(compressionQuality: 0.8)

        if let data = imageData, data.count > maxImageSize {
            // Compress further
            imageData = image.jpegData(compressionQuality: 0.5)
        }

        guard let finalData = imageData else { return }

        let base64 = "data:image/jpeg;base64," + finalData.base64EncodedString()

        DispatchQueue.main.async { [weak self] in
            self?.sharedItems.append(.image(image: image, base64: base64))
            self?.previewImageView.image = image
            self?.previewImageView.isHidden = false
        }
    }

    private func processText(_ text: String) {
        DispatchQueue.main.async { [weak self] in
            self?.sharedItems.append(.text(text))
            self?.textPreviewLabel.text = text
            self?.textPreviewLabel.isHidden = false
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

        // Update info label
        var types: [String] = []
        for item in sharedItems {
            switch item {
            case .image: types.append("image")
            case .text: types.append("text")
            }
        }

        let typeString = types.joined(separator: " and ")
        infoLabel.text = "Family Hub will scan this \(typeString) to create calendar events"
    }

    private func showError(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            self?.activityIndicator.stopAnimating()
            self?.infoLabel.text = message
            self?.addButton.isEnabled = false
        }
    }

    // MARK: - Actions
    @objc private func cancelTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    @objc private func addTapped() {
        // Save shared content to App Group for the main app to read
        saveToAppGroup()

        // Open main app with deep link
        openMainApp()
    }

    private func saveToAppGroup() {
        guard let defaults = UserDefaults(suiteName: "group.app.familyhub.home") else { return }

        var sharedData: [String: Any] = [
            "timestamp": Date().timeIntervalSince1970
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

    private func openMainApp() {
        guard let url = URL(string: "familyhub://calendar/scan") else {
            showSuccessAndClose()
            return
        }

        // Try to open the app via URL scheme
        if #available(iOS 16.0, *) {
            extensionContext?.open(url) { [weak self] success in
                if success {
                    // App opened successfully
                    self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
                } else {
                    // App didn't open - show success message with instructions
                    self?.showSuccessAndClose()
                }
            }
        } else {
            // Older iOS - just show success message
            showSuccessAndClose()
        }
    }

    private func showSuccessAndClose() {
        DispatchQueue.main.async { [weak self] in
            // Update UI to show success
            self?.addButton.isEnabled = false
            self?.addButton.setTitle("Saved!", for: .disabled)

            // Update info label with instructions
            self?.infoLabel.text = "Open Family Hub and go to Calendar to scan this image with AI"
            self?.infoLabel.textColor = .label
            self?.infoLabel.font = .systemFont(ofSize: 15, weight: .medium)

            // Add a checkmark
            let checkmark = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
            checkmark.tintColor = UIColor(red: 0.08, green: 0.72, blue: 0.65, alpha: 1.0) // Teal
            checkmark.translatesAutoresizingMaskIntoConstraints = false
            self?.containerView.addSubview(checkmark)

            if let infoLabel = self?.infoLabel, let containerView = self?.containerView {
                NSLayoutConstraint.activate([
                    checkmark.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
                    checkmark.bottomAnchor.constraint(equalTo: infoLabel.topAnchor, constant: -12),
                    checkmark.widthAnchor.constraint(equalToConstant: 48),
                    checkmark.heightAnchor.constraint(equalToConstant: 48)
                ])
            }

            // Hide the preview image
            self?.previewImageView.isHidden = true

            // Auto-close after 2 seconds
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            }
        }
    }
}

// MARK: - Shared Item Type
enum SharedItem {
    case text(String)
    case image(image: UIImage, base64: String)
}
