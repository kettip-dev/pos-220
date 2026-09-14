-- Receipt / KOT canvas-print formatting (captain-app POS).
-- Kept in a dedicated table so it never collides with the web POS `print_settings`
-- (which is upserted with VALUES() and would otherwise clobber these columns).

CREATE TABLE IF NOT EXISTS `pos_print_format` (
  `tenant_id` int NOT NULL,
  `receipt_template` varchar(20) DEFAULT 'modern',
  `kot_template` varchar(20) DEFAULT 'standard',
  `show_logo` tinyint(1) DEFAULT 1,
  `show_store_details` tinyint(1) DEFAULT 1,
  `show_customer_details` tinyint(1) DEFAULT 1,
  `show_tax_breakdown` tinyint(1) DEFAULT 1,
  `show_qr` tinyint(1) DEFAULT 0,
  `qr_type` varchar(20) DEFAULT 'feedback',
  `qr_value` varchar(500) DEFAULT NULL,
  `density` varchar(10) DEFAULT 'normal',
  `font_scale` varchar(10) DEFAULT 'normal',
  `kot_show_prices` tinyint(1) DEFAULT 0,
  `paper_width_80` int DEFAULT 576,
  `paper_width_58` int DEFAULT 384,
  `header` varchar(2000) DEFAULT NULL,
  `footer` varchar(2000) DEFAULT 'Thank you! Please visit again.',
  `footer_promo` varchar(2000) DEFAULT NULL,
  PRIMARY KEY (`tenant_id`),
  CONSTRAINT `ppf_tenantid_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
