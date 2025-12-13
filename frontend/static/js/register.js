/**
 * Register Page JavaScript
 */

class RegisterManager {
    constructor() {
        this.studentCount = 0;
        this.init();
    }
    
    init() {
        this.bindEventListeners();
        this.checkExistingSession();
        // 默认添加一个学生账号
        this.addStudentForm();
    }
    
    async checkExistingSession() {
        try {
            const response = await fetch(window.getApiUrl('/auth/session'));
            const data = await response.json();
            
            if (data.success && data.logged_in) {
                // Already logged in, redirect to dashboard
                window.location.href = '/learning-dashboard';
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    }
    
    bindEventListeners() {
        // Add student button
        const addStudentBtn = document.getElementById('addStudentBtn');
        addStudentBtn.addEventListener('click', () => this.addStudentForm());
        
        // Password toggle buttons
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePassword(e.currentTarget));
        });
        
        // Register form submit
        const registerForm = document.getElementById('registerForm');
        registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }
    
    addStudentForm() {
        this.studentCount++;
        const studentsContainer = document.getElementById('studentsContainer');
        
        const studentForm = document.createElement('div');
        studentForm.className = 'student-form';
        studentForm.id = `student-${this.studentCount}`;
        
        studentForm.innerHTML = `
            <div class="student-form-header">
                <h4 class="student-form-title">
                    <i class="fas fa-user-graduate"></i>
                    Student ${this.studentCount}
                </h4>
                <div class="student-form-actions">
                    <button type="button" class="collapse-toggle" onclick="registerManager.toggleStudentForm(${this.studentCount})">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    ${this.studentCount > 1 ? `
                    <button type="button" class="remove-student-btn" onclick="registerManager.removeStudentForm(${this.studentCount})">
                        <i class="fas fa-times"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="student-form-body">
                <div class="form-group">
                    <label for="student${this.studentCount}Username">
                        <i class="fas fa-user"></i>
                        Student Name *
                    </label>
                    <input 
                        type="text" 
                        id="student${this.studentCount}Username" 
                        class="form-input student-username" 
                        placeholder="Enter student name"
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label for="student${this.studentCount}Password">
                        <i class="fas fa-lock"></i>
                        Password *
                    </label>
                    <div class="password-input-wrapper">
                        <input 
                            type="password" 
                            id="student${this.studentCount}Password" 
                            class="form-input student-password" 
                            placeholder="At least 6 characters"
                            required
                            minlength="6"
                        >
                        <button type="button" class="toggle-password" data-target="student${this.studentCount}Password">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="student${this.studentCount}Grade">
                            <i class="fas fa-graduation-cap"></i>
                            Grade Level
                        </label>
                        <select id="student${this.studentCount}Grade" class="form-input student-grade">
                            <option value="">Select grade</option>
                            <option value="7">Grade 7</option>
                            <option value="8">Grade 8</option>
                            <option value="9">Grade 9</option>
                            <option value="10">Grade 10</option>
                            <option value="11">Grade 11</option>
                            <option value="12">Grade 12</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="student${this.studentCount}Goal">
                            <i class="fas fa-clock"></i>
                            Daily Goal (min)
                        </label>
                        <input 
                            type="number" 
                            id="student${this.studentCount}Goal" 
                            class="form-input student-goal" 
                            placeholder="60"
                            min="30"
                            max="480"
                            value="60"
                        >
                    </div>
                </div>
            </div>
        `;
        
        studentsContainer.appendChild(studentForm);
        
        // Bind toggle password for new buttons
        studentForm.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePassword(e.currentTarget));
        });
    }
    
    toggleStudentForm(id) {
        const studentForm = document.getElementById(`student-${id}`);
        if (studentForm) {
            studentForm.classList.toggle('collapsed');
        }
    }
    
    removeStudentForm(id) {
        const studentForm = document.getElementById(`student-${id}`);
        if (studentForm) {
            studentForm.remove();
        }
    }
    
    togglePassword(button) {
        const targetId = button.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        // Get parent data
        const email = document.getElementById('parentEmail').value.trim().toLowerCase();
        const username = document.getElementById('parentUsername').value.trim();
        const password = document.getElementById('parentPassword').value;
        const confirmPassword = document.getElementById('parentConfirmPassword').value;
        
        // Validate parent data
        if (!email || !username || !password) {
            Utils.showNotification('Please fill in all parent account fields', 'warning');
            return;
        }
        
        if (!email.includes('@') || !email.split('@')[1].includes('.')) {
            Utils.showNotification('Please enter a valid email address', 'warning');
            return;
        }
        
        if (password.length < 6) {
            Utils.showNotification('Password must be at least 6 characters', 'warning');
            return;
        }
        
        if (password !== confirmPassword) {
            Utils.showNotification('Passwords do not match', 'warning');
            return;
        }
        
        // Prepare registration data
        const registrationData = {
            parent: {
                email: email,
                username: username,
                password: password
            },
            students: []
        };
        
        // Get all student data
        const studentForms = document.querySelectorAll('.student-form');
        
        for (const form of studentForms) {
            const studentUsername = form.querySelector('.student-username').value.trim();
            const studentPassword = form.querySelector('.student-password').value;
            const studentGrade = form.querySelector('.student-grade').value;
            const studentGoal = form.querySelector('.student-goal').value;
            
            if (!studentUsername || !studentPassword) {
                Utils.showNotification('Please fill in all student fields or remove empty forms', 'warning');
                return;
            }
            
            if (studentPassword.length < 6) {
                Utils.showNotification('All passwords must be at least 6 characters', 'warning');
                return;
            }
            
            registrationData.students.push({
                username: studentUsername,
                password: studentPassword,
                grade_level: studentGrade || '',
                daily_goal: parseInt(studentGoal) || 60
            });
        }
        
        const registerBtn = document.getElementById('registerBtn');
        Utils.showLoadingState(registerBtn, 'Creating account...');
        
        try {
            const response = await fetch(window.getApiUrl('/auth/register'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registrationData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                Utils.showNotification('Account created successfully!', 'success');
                
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            } else {
                Utils.showNotification(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration failed:', error);
            Utils.showNotification('An error occurred, please try again', 'error');
        } finally {
            Utils.hideLoadingState(registerBtn);
        }
    }
}

// Initialize when DOM is ready
let registerManager;
document.addEventListener('DOMContentLoaded', () => {
    registerManager = new RegisterManager();
});
