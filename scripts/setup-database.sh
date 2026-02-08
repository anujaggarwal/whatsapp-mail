#!/bin/bash
set -e

DB_NAME="${DB_NAME:-whatsapp_logger}"
DB_USER="${DB_USER:-postgres}"

echo "Setting up WhatsApp Logger database..."

# Check if database exists
if psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo "Database '$DB_NAME' already exists."
else
  echo "Creating database '$DB_NAME'..."
  createdb -U "$DB_USER" "$DB_NAME"
  echo "Database created."
fi

# Run migration
echo "Running migration..."
psql -U "$DB_USER" -d "$DB_NAME" -f "$(dirname "$0")/../migrations/001_initial_schema.sql"

echo ""
echo "Verifying tables..."
psql -U "$DB_USER" -d "$DB_NAME" -c "\dt"

echo ""
echo "Setup complete!"
