-- Reset dynamic data while keeping Restaurants and Food_Items
-- This will remove all Users, Delivery_Partners, and Orders

USE food_ordering;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE Orders;
TRUNCATE TABLE Users;
TRUNCATE TABLE Delivery_Partners;
SET FOREIGN_KEY_CHECKS = 1;

-- Optional: also reset stock quantities if you want fresh inventory levels
-- Example: UPDATE Food_Items SET quantity = 100;



