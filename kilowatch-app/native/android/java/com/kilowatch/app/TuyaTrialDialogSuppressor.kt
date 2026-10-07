package com.kilowatch.app

import android.app.Activity
import android.app.Application
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import java.lang.ref.WeakReference

/**
 * Tuya SmartLife App SDK (Development edition) shows a system AlertDialog:
 * "This application is for testing only, but not for commercial use..."
 *
 * Official removal requires upgrading the Tuya app to Official edition.
 * For member demos / thesis builds, auto-tap OK so the dialog never blocks UX.
 */
object TuyaTrialDialogSuppressor {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val matchHints = listOf(
    "for testing only",
    "not for commercial use",
    "registered users reaches the limit",
    "仅用于测试",
    "非商业用途",
    "注册用户数达到上限",
  )

  fun install(application: Application) {
    application.registerActivityLifecycleCallbacks(
      object : Application.ActivityLifecycleCallbacks {
        override fun onActivityResumed(activity: Activity) {
          scheduleDismissPasses(activity)
        }

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
        override fun onActivityStarted(activity: Activity) = Unit
        override fun onActivityPaused(activity: Activity) = Unit
        override fun onActivityStopped(activity: Activity) = Unit
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
        override fun onActivityDestroyed(activity: Activity) = Unit
      }
    )
  }

  private fun scheduleDismissPasses(activity: Activity) {
    val ref = WeakReference(activity)
    listOf(0L, 400L, 1000L, 2000L, 3500L).forEach { delayMs ->
      mainHandler.postDelayed(
        {
          ref.get()?.let { dismissIfPresent(it) }
        },
        delayMs
      )
    }
  }

  private fun dismissIfPresent(activity: Activity) {
    try {
      val windows = collectWindowRoots()
      for (root in windows) {
        if (rootContainsTrialNotice(root) && clickPositiveButton(root)) {
          return
        }
      }

      // Fallback: remove the top non-activity window if it contains the notice.
      val activityDecor = activity.window?.decorView
      for (root in windows.asReversed()) {
        if (root === activityDecor) continue
        if (rootContainsTrialNotice(root)) {
          try {
            activity.windowManager.removeViewImmediate(root)
          } catch (_: Exception) {
            try {
              activity.windowManager.removeView(root)
            } catch (_: Exception) {
            }
          }
          return
        }
      }
    } catch (_: Exception) {
      // Never crash startup over a trial dialog.
    }
  }

  @Suppress("UNCHECKED_CAST")
  private fun collectWindowRoots(): List<View> {
    return try {
      val wmgClass = Class.forName("android.view.WindowManagerGlobal")
      val instance = wmgClass.getMethod("getInstance").invoke(null)
      val viewsField = wmgClass.getDeclaredField("mViews").apply { isAccessible = true }
      val views = viewsField.get(instance)
      when (views) {
        is ArrayList<*> -> views.filterIsInstance<View>()
        is Array<*> -> views.filterIsInstance<View>()
        else -> emptyList()
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun rootContainsTrialNotice(root: View): Boolean {
    val texts = ArrayList<String>()
    collectText(root, texts)
    val joined = texts.joinToString("\n").lowercase()
    return matchHints.any { hint -> joined.contains(hint.lowercase()) }
  }

  private fun collectText(view: View, out: MutableList<String>) {
    when (view) {
      is TextView -> {
        val value = view.text?.toString()?.trim().orEmpty()
        if (value.isNotEmpty()) out.add(value)
      }
      is ViewGroup -> {
        for (i in 0 until view.childCount) {
          collectText(view.getChildAt(i), out)
        }
      }
    }
  }

  private fun clickPositiveButton(root: View): Boolean {
    val buttons = ArrayList<Button>()
    collectButtons(root, buttons)
    val preferred =
      buttons.firstOrNull { btn ->
        val label = btn.text?.toString()?.trim()?.lowercase().orEmpty()
        label == "ok" || label == "确定" || label == "確認" || label == "got it"
      } ?: buttons.lastOrNull()

    preferred?.performClick()
    return preferred != null
  }

  private fun collectButtons(view: View, out: MutableList<Button>) {
    when (view) {
      is Button -> out.add(view)
      is ViewGroup -> {
        for (i in 0 until view.childCount) {
          collectButtons(view.getChildAt(i), out)
        }
      }
    }
  }
}
