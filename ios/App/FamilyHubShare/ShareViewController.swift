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
        button.setTitle("Add Event", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
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
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            return
        }

        // iOS 16+ method: open URL via extension context
        if #available(iOS 16.0, *) {
            // Use the newer open method
            extensionContext?.open(url) { success in
                self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            }
        } else {
            // Fallback for older iOS: use selector-based approach
            let selector = sel_registerName("openURL:")
            var responder: UIResponder? = self
            while let r = responder {
                if r.responds(to: selector) {
                    r.perform(selector, with: url)
                    break
                }
                responder = r.next
            }
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
}

// MARK: - Shared Item Type
enum SharedItem {
    case text(String)
    case image(image: UIImage, base64: String)
}
