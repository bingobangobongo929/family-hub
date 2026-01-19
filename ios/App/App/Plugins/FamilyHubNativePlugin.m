#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(FamilyHubNativePlugin, "FamilyHubNative",
    CAP_PLUGIN_METHOD(openDocumentScanner, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(openPhotoLibrary, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(openCamera, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(startVoiceRecognition, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(stopVoiceRecognition, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(checkVoicePermission, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestVoicePermission, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getSharedContent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearSharedContent, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(checkReduceMotion, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(writeWidgetData, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(refreshWidgets, CAPPluginReturnPromise);
)
