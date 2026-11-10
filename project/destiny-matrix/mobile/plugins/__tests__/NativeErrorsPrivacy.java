package com.arcanasense.app;

import io.sentry.Attachment;
import io.sentry.Breadcrumb;
import io.sentry.Hint;
import io.sentry.JsonSerializer;
import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import io.sentry.protocol.Device;
import io.sentry.protocol.Mechanism;
import io.sentry.protocol.OperatingSystem;
import io.sentry.protocol.Request;
import io.sentry.protocol.SentryException;
import io.sentry.protocol.SentryStackFrame;
import io.sentry.protocol.SentryStackTrace;
import io.sentry.protocol.User;
import java.io.StringWriter;
import java.util.Collections;

/** Run with the generated helper and installed Android/Sentry jars, without a device. */
public final class NativeErrorsPrivacy {
  public static void main(String[] args) throws Exception {
    String secret = "secret@example.org 1987-06-14 +79995554433 PRIVATE_TOKEN";
    SentryEvent event = new SentryEvent();
    event.setUser(new User());
    event.getUser().setId("PRIVATE_DEVICE_ID");
    event.getUser().setEmail(secret);
    event.setExtra("state", secret);
    event.setTag("account", secret);
    event.addBreadcrumb(new Breadcrumb(secret));
    event.setUnknown(Collections.singletonMap("future_field", secret));
    event.setRequest(new Request());
    event.getRequest().setUrl("https://example.org/?token=PRIVATE_TOKEN");
    event.setFingerprints(Collections.singletonList(secret));
    event.setTransaction(secret);
    Device device = new Device();
    device.setId("PRIVATE_DEVICE_ID"); device.setName(secret); device.setModel("Pixel 8");
    event.getContexts().setDevice(device);
    OperatingSystem os = new OperatingSystem();
    os.setVersion("15"); os.setRawDescription(secret);
    event.getContexts().setOperatingSystem(os);
    event.getContexts().put("account", Collections.singletonMap("email", secret));
    SentryException exception = new SentryException();
    exception.setType("RuntimeException"); exception.setModule("java.lang"); exception.setValue(secret);
    exception.setUnknown(Collections.singletonMap("future_exception", secret));
    Mechanism mechanism = new Mechanism();
    mechanism.setType(secret); mechanism.setHandled(false); mechanism.setData(Collections.singletonMap("state", secret));
    exception.setMechanism(mechanism);
    SentryStackFrame frame = new SentryStackFrame();
    frame.setFunction("crash"); frame.setModule("io.sentry.react.RNSentryModuleImpl");
    frame.setFilename("RNSentryModuleImpl.java"); frame.setLineno(42);
    frame.setAbsPath("/users/PRIVATE_TOKEN/RNSentryModuleImpl.java");
    frame.setContextLine(secret); frame.setVars(Collections.singletonMap("password", secret));
    exception.setStacktrace(new SentryStackTrace(Collections.singletonList(frame)));
    event.setExceptions(Collections.singletonList(exception));
    Hint hint = new Hint();
    Attachment attachment = new Attachment(secret.getBytes(), "private.txt");
    hint.addAttachment(attachment); hint.setScreenshot(attachment); hint.setViewHierarchy(attachment);
    hint.setThreadDump(attachment); hint.setTombstone(attachment);
    SentryEvent clean = ArcanaNativeErrors.sanitize(event, hint);
    StringWriter writer = new StringWriter();
    new JsonSerializer(SentryOptions.empty()).serialize(clean, writer);
    String json = writer.toString();
    for (String forbidden : new String[] {"secret@example.org", "1987-06-14", "+79995554433", "PRIVATE_TOKEN", "PRIVATE_DEVICE_ID", "future_field", "breadcrumbs", "request", "fingerprint", "account", "context_line", "password"}) {
      if (json.contains(forbidden)) throw new AssertionError("PII escaped filter: " + forbidden);
    }
    for (String expected : new String[] {"Native crash", "RuntimeException", "RNSentryModuleImpl.java", "\"lineno\":42", "\"function\":\"crash\"", "Pixel 8", "Android", "mobile@test"}) {
      if (!json.contains(expected)) throw new AssertionError("Diagnostic context lost: " + expected);
    }
    if (!hint.getAttachments().isEmpty() || hint.getScreenshot() != null || hint.getViewHierarchy() != null || hint.getThreadDump() != null || hint.getTombstone() != null) throw new AssertionError("Attachment escaped filter");
    if (!event.getUser().getEmail().equals(secret)) throw new AssertionError("Input event was mutated");
    System.out.println("Native serialization privacy passed: no PII, diagnostic stack retained, attachments removed");
  }
}
