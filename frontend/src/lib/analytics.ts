/**
 * Analytics tracking for frontend events
 * Replace with Google Analytics, Mixpanel, or similar in production
 */

interface AnalyticsEvent {
  name: string;
  category: string;
  value?: string | number;
  properties?: Record<string, any>;
  timestamp: string;
  sessionId: string;
  userId?: string;
}

class Analytics {
  private sessionId: string;
  private events: AnalyticsEvent[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadSessionId();
  }

  /**
   * Track user action
   */
  trackEvent(
    name: string,
    category: string,
    value?: string | number,
    properties?: Record<string, any>
  ) {
    const userId = localStorage.getItem("userEmail") || undefined;

    const event: AnalyticsEvent = {
      name,
      category,
      value,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId
    };

    this.events.push(event);

    // Send to backend
    this.sendEvent(event);

    // Log in development
    if (import.meta.env.DEV) {
      console.log("📊 Analytics:", event);
    }
  }

  /**
   * Track page view
   */
  trackPageView(pagePath: string, pageTitle?: string) {
    this.trackEvent("page_view", "navigation", undefined, {
      path: pagePath,
      title: pageTitle || document.title
    });
  }

  /**
   * Track user action
   */
  trackUserAction(action: string, details?: Record<string, any>) {
    this.trackEvent(action, "user_action", undefined, details);
  }

  /**
   * Track error
   */
  trackError(error: Error | string, context?: Record<string, any>) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.trackEvent("error", "system", undefined, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      ...context
    });
  }

  /**
   * Send event to backend (optional)
   */
  private async sendEvent(event: AnalyticsEvent) {
    try {
      // In production, send to analytics endpoint
      // await fetch("/api/analytics", { method: "POST", body: JSON.stringify(event) })
    } catch (error) {
      // Silently fail - don't block app for analytics
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadSessionId() {
    const stored = sessionStorage.getItem("analytics_session_id");
    if (stored) {
      this.sessionId = stored;
    } else {
      sessionStorage.setItem("analytics_session_id", this.sessionId);
    }
  }

  /**
   * Get session summary for debugging
   */
  getSessionSummary() {
    return {
      sessionId: this.sessionId,
      eventCount: this.events.length,
      events: this.events
    };
  }
}

export const analytics = new Analytics();
