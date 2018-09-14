CREATE DATABASE walkhome;

CREATE TABLE walkhome_user (
id SERIAL PRIMARY KEY,
email VARCHAR(255) NOT NULL UNIQUE,
first_name VARCHAR(255),
last_name varchar(255),
phone_number integer
);

// todo unique constraint across searchable fields
CREATE TABLE address_search (
  id SERIAL PRIMARY KEY,
  address VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  state VARCHAR(12) NOT NULL,
  nation VARCHAR(50) NOT NULL DEFAULT 'US',
  zip VARCHAR(50),
  latitude DECIMAL(10,4),
  longitude DECIMAL(10,4),
  neighborhood VARCHAR(100), 
  walkscore INTEGER,
  ws_explanation VARCHAR(255),
  ws_link VARCHAR(510)
);

ALTER TABLE address_search ADD search_guid UUID;

CREATE TABLE saved_search (
  user_id INT,
  address_search_id INT,
  FOREIGN KEY (user_id) REFERENCES walkhome_user(id),
  FOREIGN KEY (address_search_id) REFERENCES address_search(id)
);


