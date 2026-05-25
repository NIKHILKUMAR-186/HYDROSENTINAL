CREATE TABLE IF NOT EXISTS readings (
  id INT NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(191) NOT NULL,
  device_id VARCHAR(191) NOT NULL,
  ph FLOAT NULL,
  tds FLOAT NULL,
  turbidity FLOAT NULL,
  temperature FLOAT NULL,
  status VARCHAR(32) NULL,
  timestamp DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_device_timestamp (user_id, device_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
