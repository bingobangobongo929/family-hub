import UIKit
import Capacitor

/// Custom view controller that registers local plugins with Capacitor bridge
class FamilyHubViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        // Register our custom native plugins
        bridge?.registerPluginInstance(FamilyHubNativePlugin())

        // Register LiveActivity plugin (iOS 16.1+)
        if #available(iOS 16.1, *) {
            bridge?.registerPluginInstance(LiveActivityPlugin())
        }
    }
}
