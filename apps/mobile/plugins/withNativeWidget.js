const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Overwrites the react-native-android-widget generated files with a native
 * implementation that reads directly from SharedPreferences instead of using
 * a headless JS task (broken on RN 0.76 old-arch / PlatformConstants error).
 */
module.exports = function withNativeWidget(config) {
  return withDangerousMod(config, [
    'android',
    (dangerousConfig) => {
      const androidRoot = dangerousConfig.modRequest.platformProjectRoot;
      const pkg = dangerousConfig.android && dangerousConfig.android.package
        ? dangerousConfig.android.package
        : 'com.sauci.app';
      const pkgPath = pkg.split('.').join('/');

      // 1. Overwrite LiveDraw.java with native implementation
      const widgetDir = path.join(androidRoot, 'app/src/main/java', pkgPath, 'widget');
      fs.mkdirSync(widgetDir, { recursive: true });
      fs.writeFileSync(
        path.join(widgetDir, 'LiveDraw.java'),
        LIVE_DRAW_JAVA.replace(/com\.sauci\.app/g, pkg)
      );

      // 2. Write widget layout
      const layoutDir = path.join(androidRoot, 'app/src/main/res/layout');
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.writeFileSync(path.join(layoutDir, 'widget_live_draw.xml'), WIDGET_LAYOUT);

      // 3. Write placeholder drawable
      const drawableDir = path.join(androidRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, 'widget_placeholder.xml'), PLACEHOLDER_DRAWABLE);

      // 4. Write widget provider XML with our layout
      const xmlDir = path.join(androidRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'widgetprovider_livedraw.xml'), WIDGET_PROVIDER_XML);

      return dangerousConfig;
    },
  ]);
};

const LIVE_DRAW_JAVA = `package com.sauci.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.Base64;
import android.util.TypedValue;
import android.widget.RemoteViews;

import com.sauci.app.R;

public class LiveDraw extends AppWidgetProvider {

    private static final String PREFS_NAME_SUFFIX = ".widgetdata";
    private static final String KEY_IMAGE = "LiveDrawImage";
    private static final int BG_COLOR = 0xFF1A1A2E;
    private static final int CORNER_RADIUS_DP = 16;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, widgetId);
        }
    }

    private void updateWidget(Context context, AppWidgetManager appWidgetManager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_live_draw);

        String base64 = getStoredImage(context);
        if (base64 != null && !base64.isEmpty()) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (decoded != null) {
                    Bitmap rounded = addRoundedBackground(context, decoded);
                    views.setImageViewBitmap(R.id.widget_image, rounded);
                    decoded.recycle();
                }
            } catch (Exception e) {
                setPlaceholder(views);
            }
        } else {
            setPlaceholder(views);
        }

        appWidgetManager.updateAppWidget(widgetId, views);
    }

    private String getStoredImage(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(
            context.getPackageName() + PREFS_NAME_SUFFIX, Context.MODE_PRIVATE);
        return prefs.getString(KEY_IMAGE, null);
    }

    private void setPlaceholder(RemoteViews views) {
        views.setImageViewResource(R.id.widget_image, R.drawable.widget_placeholder);
    }

    private Bitmap addRoundedBackground(Context context, Bitmap drawing) {
        float radius = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, CORNER_RADIUS_DP,
            context.getResources().getDisplayMetrics());

        int w = drawing.getWidth();
        int h = drawing.getHeight();

        Bitmap output = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setColor(BG_COLOR);
        canvas.drawRoundRect(new RectF(0, 0, w, h), radius, radius, bgPaint);

        canvas.drawBitmap(drawing, 0, 0, null);

        return output;
    }
}
`;

const WIDGET_LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#1A1A2E">

    <ImageView
        android:id="@+id/widget_image"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:scaleType="centerInside"
        android:contentDescription="@string/widget_livedraw_description" />
</FrameLayout>
`;

const WIDGET_PROVIDER_XML = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:resizeMode="none"
    android:description="@string/widget_livedraw_description"
    android:initialLayout="@layout/widget_live_draw"
    android:previewImage="@drawable/livedraw_preview"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen">
</appwidget-provider>
`;

const PLACEHOLDER_DRAWABLE = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#1A1A2E" />
            <corners android:radius="16dp" />
        </shape>
    </item>
</layer-list>
`;
