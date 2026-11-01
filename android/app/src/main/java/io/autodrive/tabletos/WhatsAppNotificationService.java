package io.autodrive.tabletos;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class WhatsAppNotificationService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (!"com.whatsapp".equals(pkg) && !"com.whatsapp.w4b".equals(pkg)) {
            return;
        }
        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;

        Bundle extras = notification.extras;
        CharSequence titleObj = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textObj = extras.getCharSequence(Notification.EXTRA_TEXT);

        if (titleObj != null && textObj != null) {
            Intent broadcast = new Intent("io.autodrive.tabletos.WHATSAPP_NOTIFICATION");
            broadcast.setPackage(getPackageName());
            broadcast.putExtra("sender", titleObj.toString());
            broadcast.putExtra("text", textObj.toString());
            sendBroadcast(broadcast);
        }
    }
}
