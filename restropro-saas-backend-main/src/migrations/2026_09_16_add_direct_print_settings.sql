-- Migration: Add direct 80mm ESC/POS thermal printing configuration to print_settings
-- print_mode: 'browser' (default) or 'direct_escpos' (RawBT / ESC-POS)
-- auto_cut: 1 = cut paper after receipt/ticket, 0 = no cut
-- cash_drawer_kick: 1 = kick open cash drawer on cash payments, 0 = disable

ALTER TABLE `print_settings`
  ADD COLUMN `print_mode` VARCHAR(30) NOT NULL DEFAULT 'browser' AFTER `print_token`,
  ADD COLUMN `auto_cut` TINYINT(1) NOT NULL DEFAULT 1 AFTER `print_mode`,
  ADD COLUMN `cash_drawer_kick` TINYINT(1) NOT NULL DEFAULT 1 AFTER `auto_cut`;
