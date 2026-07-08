<?php
/**
 * Plugin Name: Jaxtri Affiliate Connector
 * Description: Tracks Jaxtri affiliate referral links and WooCommerce coupon codes, then sends order events to Jaxtri Academy.
 * Version: 0.1.1
 * Author: Jaxtri Labs
 */

if (!defined('ABSPATH')) {
    exit;
}

class Jaxtri_Affiliate_Connector {
    const OPTION_KEY = 'jaxtri_affiliate_connector_settings';
    const COOKIE_NAME = 'jaxtri_affiliate_code';

    public function __construct() {
        add_action('init', array($this, 'capture_referral_code'));
        add_action('admin_menu', array($this, 'add_settings_page'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_post_jaxtri_affiliate_test_webhook', array($this, 'send_test_webhook'));

        add_action('woocommerce_checkout_create_order', array($this, 'save_referral_to_order'), 20, 2);
        add_action('woocommerce_order_status_changed', array($this, 'handle_order_status_changed'), 20, 4);
        add_action('woocommerce_order_refunded', array($this, 'handle_order_refunded'), 20, 2);
    }

    private function settings() {
        $defaults = array(
            'webhook_url' => '',
            'webhook_secret' => '',
            'ref_param' => 'ref',
            'cookie_days' => 30,
            'debug_log' => '0',
        );
        $saved = get_option(self::OPTION_KEY, array());
        return wp_parse_args(is_array($saved) ? $saved : array(), $defaults);
    }

    public function add_settings_page() {
        add_options_page(
            'Jaxtri Affiliate Connector',
            'Jaxtri Affiliate',
            'manage_options',
            'jaxtri-affiliate-connector',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('jaxtri_affiliate_connector', self::OPTION_KEY, array($this, 'sanitize_settings'));
    }

    public function sanitize_settings($input) {
        $input = is_array($input) ? $input : array();
        return array(
            'webhook_url' => esc_url_raw($input['webhook_url'] ?? ''),
            'webhook_secret' => sanitize_text_field($input['webhook_secret'] ?? ''),
            'ref_param' => sanitize_key($input['ref_param'] ?? 'ref') ?: 'ref',
            'cookie_days' => max(1, min(365, intval($input['cookie_days'] ?? 30))),
            'debug_log' => !empty($input['debug_log']) ? '1' : '0',
        );
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        $s = $this->settings();
        ?>
        <div class="wrap">
            <h1>Jaxtri Affiliate Connector</h1>
            <p>This plugin tracks both affiliate referral links like <code>?ref=CODE</code> and WooCommerce coupon codes used at checkout.</p>
            <p><strong>Attribution priority:</strong> matching coupon code first, then referral cookie/link fallback.</p>
            <?php if (isset($_GET['jaxtri_test'])) : ?>
                <div class="notice notice-info"><p><?php echo esc_html(wp_unslash($_GET['jaxtri_test'])); ?></p></div>
            <?php endif; ?>
            <form method="post" action="options.php">
                <?php settings_fields('jaxtri_affiliate_connector'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="jaxtri_webhook_url">Academy webhook URL</label></th>
                        <td><input id="jaxtri_webhook_url" class="regular-text" type="url" name="<?php echo esc_attr(self::OPTION_KEY); ?>[webhook_url]" value="<?php echo esc_attr($s['webhook_url']); ?>" placeholder="https://your-academy.pages.dev/api/webhooks/woocommerce"></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="jaxtri_webhook_secret">Webhook secret</label></th>
                        <td><input id="jaxtri_webhook_secret" class="regular-text" type="password" name="<?php echo esc_attr(self::OPTION_KEY); ?>[webhook_secret]" value="<?php echo esc_attr($s['webhook_secret']); ?>"><p class="description">This must match the <code>JAXTRI_WC_WEBHOOK_SECRET</code> environment variable in Cloudflare.</p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="jaxtri_ref_param">Referral URL parameter</label></th>
                        <td><input id="jaxtri_ref_param" type="text" name="<?php echo esc_attr(self::OPTION_KEY); ?>[ref_param]" value="<?php echo esc_attr($s['ref_param']); ?>"><p class="description">Default: <code>ref</code>. Example: <code>https://store.com/?ref=BRODY</code></p></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="jaxtri_cookie_days">Cookie days</label></th>
                        <td><input id="jaxtri_cookie_days" type="number" min="1" max="365" name="<?php echo esc_attr(self::OPTION_KEY); ?>[cookie_days]" value="<?php echo esc_attr($s['cookie_days']); ?>"></td>
                    </tr>
                    <tr>
                        <th scope="row">Debug logging</th>
                        <td><label><input type="checkbox" name="<?php echo esc_attr(self::OPTION_KEY); ?>[debug_log]" value="1" <?php checked($s['debug_log'], '1'); ?>> Write webhook results to WooCommerce logs</label></td>
                    </tr>
                </table>
                <?php submit_button('Save Jaxtri Settings'); ?>
            </form>
            <hr>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('jaxtri_affiliate_test_webhook'); ?>
                <input type="hidden" name="action" value="jaxtri_affiliate_test_webhook">
                <?php submit_button('Send Test Webhook', 'secondary'); ?>
            </form>
        </div>
        <?php
    }

    public function capture_referral_code() {
        $s = $this->settings();
        $param = $s['ref_param'] ?: 'ref';
        if (empty($_GET[$param])) {
            return;
        }

        $code = $this->sanitize_affiliate_code(wp_unslash($_GET[$param]));
        if (!$code) {
            return;
        }

        $days = max(1, intval($s['cookie_days']));
        $expires = time() + ($days * DAY_IN_SECONDS);
        setcookie(self::COOKIE_NAME, $code, array(
            'expires' => $expires,
            'path' => COOKIEPATH ?: '/',
            'domain' => COOKIE_DOMAIN ?: '',
            'secure' => is_ssl(),
            'httponly' => false,
            'samesite' => 'Lax',
        ));
        $_COOKIE[self::COOKIE_NAME] = $code;
    }

    public function save_referral_to_order($order, $data) {
        if (!$order || !is_a($order, 'WC_Order')) {
            return;
        }
        $code = $this->current_referral_code();
        if ($code) {
            $order->update_meta_data('_jaxtri_affiliate_code', $code);
        }
    }

    private function sanitize_affiliate_code($value) {
        $code = sanitize_text_field($value);
        return preg_replace('/[^A-Za-z0-9_\-]/', '', $code);
    }

    private function current_referral_code() {
        if (empty($_COOKIE[self::COOKIE_NAME])) {
            return '';
        }
        return $this->sanitize_affiliate_code(wp_unslash($_COOKIE[self::COOKIE_NAME]));
    }

    private function order_coupon_codes($order) {
        if (!$order || !is_a($order, 'WC_Order') || !method_exists($order, 'get_coupon_codes')) {
            return array();
        }
        $codes = array();
        foreach ((array) $order->get_coupon_codes() as $coupon_code) {
            $clean = $this->sanitize_affiliate_code($coupon_code);
            if ($clean) {
                $codes[] = $clean;
            }
        }
        return array_values(array_unique($codes));
    }

    private function order_referral_code($order) {
        $code = '';
        if ($order && is_a($order, 'WC_Order')) {
            $code = $this->sanitize_affiliate_code($order->get_meta('_jaxtri_affiliate_code'));
        }
        return $code ?: $this->current_referral_code();
    }

    private function affiliate_code_candidates($order) {
        $coupon_codes = $this->order_coupon_codes($order);
        $referral_code = $this->order_referral_code($order);
        $candidates = $coupon_codes;
        if ($referral_code) {
            $candidates[] = $referral_code;
        }
        return array_values(array_unique(array_filter($candidates)));
    }

    public function handle_order_status_changed($order_id, $old_status, $new_status, $order) {
        if (!$order || !is_a($order, 'WC_Order')) {
            $order = wc_get_order($order_id);
        }
        if (!$order) {
            return;
        }

        $tracked_statuses = array('processing', 'completed', 'cancelled', 'canceled', 'failed', 'refunded');
        if (!in_array($new_status, $tracked_statuses, true)) {
            return;
        }

        $this->send_order_webhook($order, 'order_status_changed', $new_status);
    }

    public function handle_order_refunded($order_id, $refund_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        $this->send_order_webhook($order, 'order_refunded', 'refunded');
    }

    private function send_order_webhook($order, $event, $status) {
        $coupon_codes = $this->order_coupon_codes($order);
        $referral_code = $this->order_referral_code($order);
        $candidates = $this->affiliate_code_candidates($order);

        if (empty($candidates)) {
            return;
        }

        $payload = array(
            'provider' => 'woocommerce',
            'event' => $event,
            'wordpress_site' => home_url(),
            'order_id' => (string) $order->get_id(),
            'order_number' => (string) $order->get_order_number(),
            'order_status' => $status,
            'customer_email' => $order->get_billing_email(),
            'gross_amount' => (float) $order->get_total(),
            'currency' => $order->get_currency(),
            'affiliate_code' => $candidates[0],
            'affiliate_code_candidates' => $candidates,
            'coupon_codes' => $coupon_codes,
            'referral_code' => $referral_code,
            'attribution_priority' => 'coupon_then_referral',
            'created_at' => $order->get_date_created() ? $order->get_date_created()->date('c') : null,
            'paid_at' => $order->get_date_paid() ? $order->get_date_paid()->date('c') : null,
        );

        $this->post_to_jaxtri($payload);
    }

    public function send_test_webhook() {
        if (!current_user_can('manage_options') || !check_admin_referer('jaxtri_affiliate_test_webhook')) {
            wp_die('Unauthorized');
        }

        $payload = array(
            'provider' => 'woocommerce',
            'event' => 'test',
            'wordpress_site' => home_url(),
            'order_id' => 'test-' . time(),
            'order_status' => 'completed',
            'customer_email' => get_option('admin_email'),
            'gross_amount' => 1,
            'currency' => 'USD',
            'affiliate_code' => 'TEST',
            'affiliate_code_candidates' => array('TEST'),
            'coupon_codes' => array('TEST'),
            'referral_code' => '',
            'attribution_priority' => 'coupon_then_referral',
        );

        $result = $this->post_to_jaxtri($payload, true);
        $message = is_wp_error($result) ? $result->get_error_message() : 'Test webhook sent. Response: ' . wp_remote_retrieve_body($result);
        wp_safe_redirect(add_query_arg('jaxtri_test', rawurlencode($message), admin_url('options-general.php?page=jaxtri-affiliate-connector')));
        exit;
    }

    private function post_to_jaxtri($payload, $return_response = false) {
        $s = $this->settings();
        $url = trim($s['webhook_url']);
        $secret = trim($s['webhook_secret']);
        if (!$url || !$secret) {
            return new WP_Error('jaxtri_missing_settings', 'Jaxtri webhook URL or secret is missing.');
        }

        $response = wp_remote_post($url, array(
            'timeout' => 15,
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-Jaxtri-Secret' => $secret,
            ),
            'body' => wp_json_encode($payload),
        ));

        if ($s['debug_log'] === '1' && function_exists('wc_get_logger')) {
            $logger = wc_get_logger();
            $logger->info('Jaxtri payload: ' . wp_json_encode($payload), array('source' => 'jaxtri-affiliate-connector'));
            if (is_wp_error($response)) {
                $logger->error('Jaxtri error: ' . $response->get_error_message(), array('source' => 'jaxtri-affiliate-connector'));
            } else {
                $logger->info('Jaxtri response: ' . wp_remote_retrieve_body($response), array('source' => 'jaxtri-affiliate-connector'));
            }
        }

        return $return_response ? $response : null;
    }
}

new Jaxtri_Affiliate_Connector();
