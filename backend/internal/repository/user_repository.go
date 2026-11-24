package repository

import (
	"context"
	"database/sql"
	"errors"

	"task-management-api/internal/model"
)

var ErrEmailAlreadyExists = errors.New("email sudah digunakan")
var ErrUserNotFound = errors.New("user tidak ditemukan")

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) CreateUser(ctx context.Context, user *model.User) error {
	// Cek duplikasi email
	var exists int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(1) FROM users WHERE email = ?", user.Email).Scan(&exists)
	if err != nil {
		return err
	}
	if exists > 0 {
		return ErrEmailAlreadyExists
	}

	query := `INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, 'USER', 1)`
	res, err := r.db.ExecContext(ctx, query, user.Name, user.Email, user.Password)
	if err != nil {
		return err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	user.ID = id
	user.Role = "USER"
	user.IsActive = true
	return nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `SELECT id, name, email, password, role, is_active, created_at, updated_at FROM users WHERE email = ?`
	var u model.User
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.ID, &u.Name, &u.Email, &u.Password, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id int64) (*model.User, error) {
	query := `SELECT id, name, email, password, role, is_active, created_at, updated_at FROM users WHERE id = ?`
	var u model.User
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&u.ID, &u.Name, &u.Email, &u.Password, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	return &u, nil
}