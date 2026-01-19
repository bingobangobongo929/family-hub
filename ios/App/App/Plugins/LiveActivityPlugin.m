#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LiveActivityPlugin, "LiveActivity",
    CAP_PLUGIN_METHOD(startTimerActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(updateTimerActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(endTimerActivity, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
)
