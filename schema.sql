-- Online Food Ordering System - MySQL Schema and Stored Procedure
-- Database: food_ordering

DROP DATABASE IF EXISTS food_ordering;
CREATE DATABASE food_ordering;
USE food_ordering;

-- Tables
CREATE TABLE Users (
  user_id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(50) UNIQUE NOT NULL,
  phone VARCHAR(15),
  address VARCHAR(150),
  password VARCHAR(100) NOT NULL DEFAULT 'password'
) ENGINE=InnoDB;

CREATE TABLE Restaurants (
  restaurant_id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(150) NOT NULL,
  password VARCHAR(100) NOT NULL DEFAULT 'password'
) ENGINE=InnoDB;

CREATE TABLE Food_Items (
  item_id INT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  item_name VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_food_restaurant FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Delivery_Partners (
  partner_id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(15),
  password VARCHAR(100) NOT NULL DEFAULT 'password'
) ENGINE=InnoDB;

CREATE TABLE Orders (
  order_id INT PRIMARY KEY,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity INT NOT NULL,
  partner_id INT NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  order_date DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL,
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES Users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_order_restaurant FOREIGN KEY (restaurant_id) REFERENCES Restaurants(restaurant_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_order_item FOREIGN KEY (item_id) REFERENCES Food_Items(item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_order_partner FOREIGN KEY (partner_id) REFERENCES Delivery_Partners(partner_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Sample Data
INSERT INTO Users (user_id, name, email, phone, address, password) VALUES
  (1, 'Alice Johnson', 'alice@example.com', '9990001111', '12 Residency Road, Bengaluru', 'alice123'),
  (2, 'Bob Smith', 'bob@example.com', '9990002222', '55 Camac Street, Kolkata', 'bob123'),
  (3, 'Charlie Lee', 'charlie@example.com', '9990003333', '9 Apte Road, Pune', 'charlie123');

INSERT INTO Restaurants (restaurant_id, name, address) VALUES
  (1, 'Spice Garden', '12 MG Road, Bengaluru'),
  (2, 'Urban Bites', '44 Park Street, Kolkata'),
  (3, 'Curry House', '88 FC Road, Pune'),
  (4, 'Bombay Darbar', '21 Linking Road, Mumbai'),
  (5, 'Tandoori Nights', '63 Connaught Place, New Delhi');

INSERT INTO Food_Items (item_id, restaurant_id, item_name, price, quantity) VALUES
  -- Spice Garden
  (1, 1, 'Paneer Tikka', 199.00, 50),
  (2, 1, 'Veg Biryani', 249.00, 40),
  (3, 1, 'Butter Naan', 39.00, 200),
  (10, 1, 'Dal Makhani', 179.00, 60),
  (11, 1, 'Gulab Jamun', 89.00, 100),
  -- Urban Bites
  (4, 2, 'Chicken Roll', 149.00, 60),
  (5, 2, 'Momo Platter', 189.00, 50),
  (6, 2, 'Iced Tea', 79.00, 100),
  (12, 2, 'Hakka Noodles', 159.00, 70),
  (13, 2, 'Chilli Chicken', 219.00, 45),
  -- Curry House
  (7, 3, 'Masala Dosa', 99.00, 80),
  (8, 3, 'Idli Sambar', 69.00, 120),
  (9, 3, 'Filter Coffee', 59.00, 150),
  (14, 3, 'Medu Vada', 79.00, 90),
  (15, 3, 'Upma', 89.00, 70),
  -- Bombay Darbar
  (16, 4, 'Vada Pav', 39.00, 200),
  (17, 4, 'Pav Bhaji', 139.00, 90),
  (18, 4, 'Misal Pav', 129.00, 80),
  (19, 4, 'Falooda', 129.00, 70),
  (20, 4, 'Bombay Sandwich', 99.00, 100),
  -- Tandoori Nights
  (21, 5, 'Chicken Tandoori', 299.00, 50),
  (22, 5, 'Malai Tikka', 279.00, 50),
  (23, 5, 'Lacha Paratha', 49.00, 200),
  (24, 5, 'Jeera Rice', 129.00, 120),
  (25, 5, 'Phirni', 109.00, 100);

INSERT INTO Delivery_Partners (partner_id, name, phone, password) VALUES
  (1, 'Ravi Kumar', '8881112222', 'ravi123'),
  (2, 'Sneha Patil', '8881113333', 'sneha123'),
  (3, 'Arjun Mehta', '8881114444', 'arjun123');

-- Stored Procedure: Place_Order
DROP PROCEDURE IF EXISTS Place_Order;
DELIMITER $$
CREATE PROCEDURE Place_Order(
  IN p_order_id INT,
  IN p_user_id INT,
  IN p_restaurant_id INT,
  IN p_item_id INT,
  IN p_quantity INT,
  IN p_partner_id INT
)
BEGIN
  DECLARE v_price DECIMAL(10,2);
  DECLARE v_stock INT;

  -- Begin atomic section for stock check and update
  START TRANSACTION;

  -- Ensure the item belongs to the restaurant and lock the row
  SELECT price, quantity
    INTO v_price, v_stock
  FROM Food_Items
  WHERE item_id = p_item_id AND restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF v_price IS NULL THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found for the specified restaurant';
  END IF;

  IF v_stock < p_quantity THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough stock available';
  END IF;

  INSERT INTO Orders (
    order_id, user_id, restaurant_id, item_id, quantity, partner_id,
    total_price, order_date, status
  ) VALUES (
    p_order_id, p_user_id, p_restaurant_id, p_item_id, p_quantity, p_partner_id,
    v_price * p_quantity, NOW(), 'Placed'
  );

  UPDATE Food_Items
  SET quantity = quantity - p_quantity
  WHERE item_id = p_item_id;

  COMMIT;
END $$
DELIMITER ;

-- Example call:
-- CALL Place_Order(101, 1, 2, 5, 2, 3);


