// Mock environment variables for testing
process.env.PORT = "3000";
process.env.SENDGRID_API_KEY = "SG.test-sendgrid-api-key";
process.env.SENDGRID_EMAIL_TEMPLATE_ID = "test-template-id";
process.env.TWILIO_ACCOUNT_SID = "ACtest-twilio-account-sid";
process.env.TWILIO_AUTH_TOKEN = "test-twilio-auth-token";
process.env.TWILIO_PHONE_NUMBER = "+1234567890";
process.env.ACCESS_SECRET = "test-access-secret";
process.env.LOG_LEVEL = "error"; // Set to error to reduce noise during tests
process.env.DD_SERVICE = "tee-ts-test";
process.env.DD_ENV = "test";
process.env.DD_VERSION = "test";
process.env.DATADOG_API_KEY = "test-datadog-api-key";
process.env.DATADOG_METRICS_ENABLED = "false"; // Disable metrics during testing
