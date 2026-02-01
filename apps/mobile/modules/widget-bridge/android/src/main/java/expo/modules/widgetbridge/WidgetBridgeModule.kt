package expo.modules.widgetbridge

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WidgetBridgeModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("WidgetBridge")

        Function("setWidgetData") { key: String, value: String ->
            val ctx = requireNotNull(appContext.reactContext)
            ctx.getSharedPreferences("${ctx.packageName}.widgetdata", Context.MODE_PRIVATE)
                .edit()
                .putString(key, value)
                .apply()
        }

        Function("reloadWidgets") {
            val ctx = requireNotNull(appContext.reactContext)
            val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
            val widgetManager = AppWidgetManager.getInstance(ctx)
            val providers = ctx.packageManager.queryBroadcastReceivers(
                Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE),
                PackageManager.GET_META_DATA
            )
            for (provider in providers) {
                if (provider.activityInfo.packageName == ctx.packageName) {
                    val component = ComponentName(
                        provider.activityInfo.packageName,
                        provider.activityInfo.name
                    )
                    val ids = widgetManager.getAppWidgetIds(component)
                    if (ids.isNotEmpty()) {
                        val updateIntent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                        updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                        updateIntent.component = component
                        ctx.sendBroadcast(updateIntent)
                    }
                }
            }
        }
    }
}
