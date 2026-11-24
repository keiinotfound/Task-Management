package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"task-management-api/internal/dto"
	"task-management-api/internal/model"
	"task-management-api/internal/repository"
)

var (
	ErrInvalidPriority       = errors.New("priority harus LOW, MEDIUM, atau HIGH")
	ErrInvalidStatus         = errors.New("status harus TODO, IN_PROGRESS, atau DONE")
	ErrInvalidDueDate        = errors.New("format due_date harus YYYY-MM-DD")
	ErrCategoryOwnershipFail = errors.New("kategori tidak ditemukan atau bukan milik Anda")
)

type TaskService struct {
	taskRepo *repository.TaskRepository
	catRepo  *repository.CategoryRepository
}

func NewTaskService(taskRepo *repository.TaskRepository, catRepo *repository.CategoryRepository) *TaskService {
	return &TaskService{
		taskRepo: taskRepo,
		catRepo:  catRepo,
	}
}

func isValidPriority(p string) bool {
	return p == "LOW" || p == "MEDIUM" || p == "HIGH"
}

func isValidStatus(s string) bool {
	return s == "TODO" || s == "IN_PROGRESS" || s == "DONE"
}

func isValidDate(d string) bool {
	_, err := time.Parse("2006-01-02", d)
	return err == nil
}

func (s *TaskService) CreateTask(ctx context.Context, userID int64, req dto.CreateTaskRequest) (*model.Task, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("title wajib diisi")
	}

	priority := "MEDIUM"
	if req.Priority != "" {
		priority = strings.ToUpper(strings.TrimSpace(req.Priority))
		if !isValidPriority(priority) {
			return nil, ErrInvalidPriority
		}
	}

	status := "TODO"
	if req.Status != "" {
		status = strings.ToUpper(strings.TrimSpace(req.Status))
		if !isValidStatus(status) {
			return nil, ErrInvalidStatus
		}
	}

	var dueDate *string
	if req.DueDate != nil && strings.TrimSpace(*req.DueDate) != "" {
		d := strings.TrimSpace(*req.DueDate)
		if !isValidDate(d) {
			return nil, ErrInvalidDueDate
		}
		dueDate = &d
	}

	// Wajib pastikan category_id milik user yang sama (Bagian 5.4)
	if req.CategoryID != nil {
		if _, err := s.catRepo.FindByIDAndUserID(ctx, *req.CategoryID, userID); err != nil {
			return nil, ErrCategoryOwnershipFail
		}
	}

	task := &model.Task{
		UserID:      userID,
		CategoryID:  req.CategoryID,
		Title:       title,
		Description: req.Description,
		Priority:    priority,
		Status:      status,
		DueDate:     dueDate,
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, err
	}

	return s.taskRepo.FindByIDAndUserID(ctx, task.ID, userID)
}

func (s *TaskService) GetTaskByID(ctx context.Context, id, userID int64) (*model.Task, error) {
	return s.taskRepo.FindByIDAndUserID(ctx, id, userID)
}

func (s *TaskService) GetTasks(ctx context.Context, userID int64, params dto.TaskFilterParams) (*dto.PaginatedResponse, error) {
	if params.Status != "" {
		params.Status = strings.ToUpper(strings.TrimSpace(params.Status))
		if !isValidStatus(params.Status) {
			return nil, ErrInvalidStatus
		}
	}
	if params.Priority != "" {
		params.Priority = strings.ToUpper(strings.TrimSpace(params.Priority))
		if !isValidPriority(params.Priority) {
			return nil, ErrInvalidPriority
		}
	}
	return s.taskRepo.FindAllByUserID(ctx, userID, params)
}

func (s *TaskService) UpdateTask(ctx context.Context, id, userID int64, req dto.UpdateTaskRequest) (*model.Task, error) {
	// Cek kepemilikan task terlebih dahulu
	existing, err := s.taskRepo.FindByIDAndUserID(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, errors.New("title wajib diisi")
	}

	priority := strings.ToUpper(strings.TrimSpace(req.Priority))
	if !isValidPriority(priority) {
		return nil, ErrInvalidPriority
	}

	status := strings.ToUpper(strings.TrimSpace(req.Status))
	if !isValidStatus(status) {
		return nil, ErrInvalidStatus
	}

	var dueDate *string
	if req.DueDate != nil && strings.TrimSpace(*req.DueDate) != "" {
		d := strings.TrimSpace(*req.DueDate)
		if !isValidDate(d) {
			return nil, ErrInvalidDueDate
		}
		dueDate = &d
	}

	if req.CategoryID != nil {
		if _, err := s.catRepo.FindByIDAndUserID(ctx, *req.CategoryID, userID); err != nil {
			return nil, ErrCategoryOwnershipFail
		}
	}

	existing.Title = title
	existing.Description = req.Description
	existing.CategoryID = req.CategoryID
	existing.Priority = priority
	existing.Status = status
	existing.DueDate = dueDate

	if err := s.taskRepo.Update(ctx, existing); err != nil {
		return nil, err
	}

	return s.taskRepo.FindByIDAndUserID(ctx, id, userID)
}

func (s *TaskService) DeleteTask(ctx context.Context, id, userID int64) error {
	return s.taskRepo.Delete(ctx, id, userID)
}

func (s *TaskService) GetDashboard(ctx context.Context, userID int64) (*model.UserDashboardSummary, error) {
	return s.taskRepo.GetDashboardSummary(ctx, userID)
}