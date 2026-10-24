import {
  loadWooCommerceConfig,
  WooCommerceClient,
  WooCommerceConfigurationError,
  WooCommerceRequestError,
} from "../woocommerce.js";

function nextAction(error: WooCommerceRequestError): string {
  switch (error.category) {
    case "DNS":
      return "Check the store hostname's public DNS records with the hosting provider.";
    case "NETWORK_TLS":
      return "Check outbound HTTPS access, the store's TLS certificate chain, firewall, and hosting availability.";
    case "REDIRECT":
      return "Set WOOCOMMERCE_STORE_URL to the final canonical HTTPS origin or WordPress subdirectory without relying on a redirect.";
    case "AUTHENTICATION":
      return "Regenerate an active read-only WooCommerce REST API key and verify both values were copied completely.";
    case "PERMISSIONS":
      return "Confirm the API key is read-enabled and belongs to a WordPress user allowed to read WooCommerce products; also check WAF rules.";
    case "REST_API_NOT_FOUND":
      return "Confirm WooCommerce is active, use non-Plain WordPress permalinks, save permalinks again, and verify the wc/v3 REST route is available.";
    case "RATE_LIMITED":
      return "Wait for the host or WAF rate-limit window to reset, then retry once.";
    case "SERVER_ERROR":
      return "Check WooCommerce, WordPress, PHP, reverse-proxy, and hosting error logs for this request time.";
    case "INVALID_RESPONSE":
      return "Check whether a cache, security plugin, maintenance page, or proxy is replacing the WooCommerce JSON response.";
    case "SECURITY":
      return "Use only the canonical public HTTPS store URL; private or local destinations remain blocked.";
    case "HTTP_ERROR":
      return "Check the reported HTTP status in the hosting or WooCommerce logs.";
    case "INVALID_INPUT":
      return "Check the configured page and sample-size parameters.";
  }
}

async function main(): Promise<void> {
  let config;
  try {
    config = loadWooCommerceConfig();
  } catch (error) {
    if (error instanceof WooCommerceConfigurationError) {
      console.error(`WooCommerce live check not run: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  try {
    const sample = await new WooCommerceClient(config).fetchProductSample(1, 3);
    console.log(
      `WooCommerce connection verified: fetched ${sample.products.length} product(s) from page ${sample.page}.`,
    );
  } catch (error) {
    if (error instanceof WooCommerceRequestError) {
      const status = error.status === undefined ? "" : ` status=${error.status}`;
      console.error(
        `WooCommerce connection check failed: category=${error.category}${status}. Next action: ${nextAction(error)}`,
      );
    } else {
      console.error(
        "WooCommerce connection check failed: category=UNKNOWN. Next action: Check backend connectivity and hosting logs. No credentials or response body were logged.",
      );
    }
    process.exitCode = 1;
  }
}

void main().catch(() => {
  console.error(
    "WooCommerce connection check could not complete. No credentials were logged.",
  );
  process.exitCode = 1;
});
