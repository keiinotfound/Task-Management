package main

import (
	"context"
	"database/sql"
	"log"
	"os"
	"time"

	"task-management-api/config"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("Info: file .env tidak ditemukan, membaca dari environment system")
	}

	db, err := config.ConnectDB()
	if err != nil {
		log.Fatalf("Gagal terhubung ke database: %v", err)
	}
	defer db.Close()

	adminName := os.Getenv("ADMIN_NAME")
	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPassword := os.Getenv("ADMIN_PASSWORD")

	if adminName == "" || adminEmail == "" || adminPassword == "" {
		log.Fatal("ADMIN_NAME, ADMIN_EMAIL, dan ADMIN_PASSWORD wajib diisi di .env")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Cek apakah admin sudah ada agar aman jika dijalankan ulang
	var existingID int64
	err = db.QueryRowContext(ctx, "SELECT id FROM users WHERE email = ?", adminEmail).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		log.Fatalf("Gagal mengecek data admin: %v", err)
	}
	if existingID > 0 {
		log.Printf("Akun Admin (%s) sudah terdaftar dengan ID %d. Proses seeder dilewati.\n", adminEmail, existingID)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Gagal melakukan hash password: %v", err)
	}

	query := `INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'ADMIN', 1)`
	result, err := db.ExecContext(ctx, query, adminName, adminEmail, string(hashedPassword))
	if err != nil {
		log.Fatalf("Gagal menyimpan data admin: %v", err)
	}

	insertedID, _ := result.LastInsertId()
	log.Printf("Sukses! Admin pertama berhasil dibuat (ID: %d, Email: %s)\n", insertedID, adminEmail)
}