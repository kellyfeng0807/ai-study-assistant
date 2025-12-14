/**
 * Parent Settings Page JavaScript
 */

let parentData = null;
let studentAccounts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadParentProfile();
    await loadStudentAccounts();
    initEventListeners();
});

/**
 * Load parent account information
 */
async function loadParentProfile() {
    try {
        const response = await fetch(window.getApiUrl('/auth/session'));
        const data = await response.json();
        
        if (data.logged_in && data.user) {
            parentData = data.user;
            
            // Display parent info
            document.getElementById('parentUserIdDisplay').textContent = parentData.user_id || '-';
            document.getElementById('parentUsernameDisplay').textContent = parentData.username || '-';
            document.getElementById('parentEmailDisplay').textContent = parentData.email || '-';
            
            // Update username input
            document.getElementById('parentUsername').value = parentData.username || '';
        } else {
            showMessage('Not logged in', 'error');
            setTimeout(() => window.location.href = '/login', 1000);
        }
    } catch (error) {
        console.error('Failed to load parent profile:', error);
        showMessage('Failed to load profile', 'error');
    }
}

/**
 * Load student accounts under this parent
 */
async function loadStudentAccounts() {
    const container = document.getElementById('studentCardsContainer');
    
    try {
        const response = await fetch(window.getApiUrl('/auth/children'));
        const data = await response.json();
        
        if (data.success && data.children && data.children.length > 0) {
            studentAccounts = data.children;
            renderStudentCards(studentAccounts);
        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-graduate"></i>
                    <p>No student accounts linked yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load student accounts:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load student accounts</p>
            </div>
        `;
    }
}

/**
 * Render student account cards
 */
function renderStudentCards(students) {
    const container = document.getElementById('studentCardsContainer');
    
    container.innerHTML = students.map(student => `
        <div class="student-card" data-student-id="${student.user_id}">
            <div class="student-card-header">
                <div class="student-avatar">${(student.username || 'S')[0].toUpperCase()}</div>
                <div class="student-card-title">
                    <h4 class="student-name">${student.username || 'Student'}</h4>
                    <span class="student-type">Student Account</span>
                </div>
                <div class="student-card-actions">
                    <button class="icon-btn edit-student-btn" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            
            <div class="student-card-body">
                <div class="student-field">
                    <div class="field-label">
                        <i class="fas fa-id-card"></i>
                        <span>User ID</span>
                    </div>
                    <div class="field-value">
                        <span class="display-text">${student.user_id}</span>
                    </div>
                </div>
                
                <div class="student-field">
                    <div class="field-label">
                        <i class="fas fa-user"></i>
                        <span>Name</span>
                    </div>
                    <div class="field-value">
                        <span class="display-text student-name-display">${student.username || '-'}</span>
                        <input type="text" class="setting-input student-name-input" value="${student.username || ''}" style="display: none;">
                    </div>
                </div>
                
                <div class="student-field">
                    <div class="field-label">
                        <i class="fas fa-lock"></i>
                        <span>Password</span>
                    </div>
                    <div class="field-value">
                        <span class="display-text">••••••••</span>
                        <input type="password" class="setting-input student-password-input" placeholder="Enter new password" style="display: none;">
                    </div>
                </div>
                
                <div class="student-field">
                    <div class="field-label">
                        <i class="fas fa-graduation-cap"></i>
                        <span>Grade</span>
                    </div>
                    <div class="field-value">
                        <span class="display-text student-grade-display">Grade ${student.grade_level || 9}</span>
                        <select class="setting-select student-grade-select" style="display: none;">
                            ${[7, 8, 9, 10, 11, 12].map(g => 
                                `<option value="${g}" ${g == student.grade_level ? 'selected' : ''}>Grade ${g}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="student-field">
                    <div class="field-label">
                        <i class="fas fa-bullseye"></i>
                        <span>Goal</span>
                    </div>
                    <div class="field-value">
                        <span class="display-text student-goal-display">${student.daily_goal || 60} min</span>
                        <input type="number" class="setting-input student-goal-input" value="${student.daily_goal || 60}" min="30" max="480" style="display: none;">
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Bind edit buttons
    container.querySelectorAll('.edit-student-btn').forEach(btn => {
        btn.addEventListener('click', handleEditStudent);
    });
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Parent account edit
    const editParentBtn = document.getElementById('editParentBtn');
    const saveParentBtn = document.getElementById('saveParentSettings');
    const cancelParentBtn = document.getElementById('cancelParentEdit');
    
    if (editParentBtn) {
        editParentBtn.addEventListener('click', toggleParentEdit);
    }
    
    if (saveParentBtn) {
        saveParentBtn.addEventListener('click', saveParentSettings);
    }
    
    if (cancelParentBtn) {
        cancelParentBtn.addEventListener('click', cancelParentEdit);
    }
    
    // Password field show/hide confirm
    const parentPasswordInput = document.getElementById('parentNewPassword');
    if (parentPasswordInput) {
        parentPasswordInput.addEventListener('input', (e) => {
            const confirmItem = document.getElementById('parentConfirmPasswordItem');
            if (e.target.value) {
                confirmItem.style.display = 'flex';
            } else {
                confirmItem.style.display = 'none';
            }
        });
    }
}

/**
 * Toggle parent account edit mode
 */
function toggleParentEdit() {
    const isEditing = document.getElementById('parentEditActions').style.display !== 'none';
    
    if (isEditing) {
        cancelParentEdit();
    } else {
        // Show inputs, hide displays
        document.getElementById('parentUsernameDisplay').style.display = 'none';
        document.getElementById('parentUsername').style.display = 'block';
        
        document.getElementById('parentPasswordDisplay').style.display = 'none';
        document.getElementById('parentNewPassword').style.display = 'block';
        
        document.getElementById('parentEditActions').style.display = 'flex';
        document.getElementById('editParentBtn').innerHTML = '<i class="fas fa-times"></i><span>Cancel</span>';
    }
}

/**
 * Save parent settings
 */
async function saveParentSettings() {
    const newUsername = document.getElementById('parentUsername').value.trim();
    const newPassword = document.getElementById('parentNewPassword').value;
    const confirmPassword = document.getElementById('parentConfirmPassword').value;
    
    // Validation
    if (!newUsername) {
        showMessage('Username cannot be empty', 'error');
        return;
    }
    
    if (newPassword && newPassword !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword && newPassword.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        const updates = { username: newUsername };
        if (newPassword) {
            updates.password = newPassword;
        }
        
        const response = await fetch(window.getApiUrl('/auth/update-profile'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Settings saved successfully', 'success');
            await loadParentProfile();
            cancelParentEdit();
        } else {
            showMessage(data.error || 'Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
        showMessage('Failed to save settings', 'error');
    }
}

/**
 * Cancel parent edit mode
 */
function cancelParentEdit() {
    document.getElementById('parentUsernameDisplay').style.display = 'inline';
    document.getElementById('parentUsername').style.display = 'none';
    
    document.getElementById('parentPasswordDisplay').style.display = 'inline';
    document.getElementById('parentNewPassword').style.display = 'none';
    document.getElementById('parentNewPassword').value = '';
    
    document.getElementById('parentConfirmPasswordItem').style.display = 'none';
    document.getElementById('parentConfirmPassword').value = '';
    
    document.getElementById('parentEditActions').style.display = 'none';
    document.getElementById('editParentBtn').innerHTML = '<i class="fas fa-edit"></i><span>Edit</span>';
}

/**
 * Handle edit student button click
 */
function handleEditStudent(e) {
    const card = e.target.closest('.student-card');
    const isEditing = card.classList.contains('editing');
    
    if (isEditing) {
        cancelStudentEdit(card);
    } else {
        enterStudentEditMode(card);
    }
}

/**
 * Enter student edit mode
 */
function enterStudentEditMode(card) {
    card.classList.add('editing');
    
    // Hide displays, show inputs
    card.querySelector('.student-name-display').style.display = 'none';
    card.querySelector('.student-name-input').style.display = 'block';
    
    card.querySelector('.student-password-input').style.display = 'block';
    card.querySelectorAll('.field-value .display-text')[1].style.display = 'none';
    
    card.querySelector('.student-grade-display').style.display = 'none';
    card.querySelector('.student-grade-select').style.display = 'block';
    
    card.querySelector('.student-goal-display').style.display = 'none';
    card.querySelector('.student-goal-input').style.display = 'block';
    
    // Change edit button to cancel and add save actions
    const editBtn = card.querySelector('.edit-student-btn');
    editBtn.innerHTML = '<i class="fas fa-times"></i>';
    editBtn.title = 'Cancel';
    
    // Add action buttons
    const cardBody = card.querySelector('.student-card-body');
    if (!card.querySelector('.card-actions')) {
        const actionsHtml = `
            <div class="card-actions">
                <button class="button-save save-student-btn">
                    <i class="fas fa-save"></i>
                    Save Changes
                </button>
                <button class="button-cancel cancel-student-btn">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
            </div>
        `;
        cardBody.insertAdjacentHTML('afterend', actionsHtml);
        
        card.querySelector('.save-student-btn').addEventListener('click', () => saveStudentSettings(card));
        card.querySelector('.cancel-student-btn').addEventListener('click', () => cancelStudentEdit(card));
    }
}

/**
 * Cancel student edit mode
 */
function cancelStudentEdit(card) {
    card.classList.remove('editing');
    
    // Show displays, hide inputs
    card.querySelector('.student-name-display').style.display = 'inline';
    card.querySelector('.student-name-input').style.display = 'none';
    
    card.querySelector('.student-password-input').style.display = 'none';
    card.querySelector('.student-password-input').value = '';
    card.querySelectorAll('.field-value .display-text')[1].style.display = 'inline';
    
    card.querySelector('.student-grade-display').style.display = 'inline';
    card.querySelector('.student-grade-select').style.display = 'none';
    
    card.querySelector('.student-goal-display').style.display = 'inline';
    card.querySelector('.student-goal-input').style.display = 'none';
    
    // Change cancel button back to edit
    const editBtn = card.querySelector('.edit-student-btn');
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.title = 'Edit';
    
    // Remove action buttons
    const actions = card.querySelector('.card-actions');
    if (actions) {
        actions.remove();
    }
}

/**
 * Save student settings
 */
async function saveStudentSettings(card) {
    const studentId = card.dataset.studentId;
    const newName = card.querySelector('.student-name-input').value.trim();
    const newPassword = card.querySelector('.student-password-input').value;
    const newGrade = parseInt(card.querySelector('.student-grade-select').value);
    const newGoal = parseInt(card.querySelector('.student-goal-input').value);
    
    // Validation
    if (!newName) {
        showMessage('Student name cannot be empty', 'error');
        return;
    }
    
    if (newPassword && newPassword.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (newGoal < 30 || newGoal > 480) {
        showMessage('Daily goal must be between 30 and 480 minutes', 'error');
        return;
    }
    
    try {
        const updates = {
            user_id: studentId,
            username: newName,
            grade_level: newGrade,
            daily_goal: newGoal
        };
        
        if (newPassword) {
            updates.password = newPassword;
        }
        
        const response = await fetch(window.getApiUrl('/auth/update-student'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Student settings saved successfully', 'success');
            await loadStudentAccounts();
        } else {
            showMessage(data.error || 'Failed to save student settings', 'error');
        }
    } catch (error) {
        console.error('Failed to save student settings:', error);
        showMessage('Failed to save student settings', 'error');
    }
}

/**
 * Show message
 */
function showMessage(message, type = 'info') {
    // Use existing message modal if available
    if (window.MessageModal && window.MessageModal.show) {
        window.MessageModal.show(message, type);
    } else {
        alert(message);
    }
}
