package com.sauci.app.widget;

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
