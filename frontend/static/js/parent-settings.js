/**
 * Parent Settings Page JavaScript
 */

let parentData = null;
let allAccounts = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadParentProfile();
    await loadAllAccounts();
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
 * Load all accounts (students and other parents under this parent)
 */
async function loadAllAccounts() {
    const container = document.getElementById('studentAccountsContainer');
    
    try {
        const response = await fetch(window.getApiUrl('/auth/children'));
        const data = await response.json();
        
        if (data.success && data.children && data.children.length > 0) {
            allAccounts = data.children;
            renderAccountCards(allAccounts);
        } else {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                    <i class="fas fa-user-graduate" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                    <p>No child accounts yet. Click "Add New Account" to create one.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load accounts:', error);
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-tertiary);">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 16px; display: block; opacity: 0.3;"></i>
                <p>Failed to load accounts</p>
            </div>
        `;
    }
}

/**
 * Render account cards (each as a settings-section)
 */
function renderAccountCards(accounts) {
    const container = document.getElementById('studentAccountsContainer');
    
    container.innerHTML = accounts.map(account => {
        const isStudent = account.account_type === 'student';
        const icon = isStudent ? 'fa-user-graduate' : 'fa-user-tie';
        const typeLabel = isStudent ? 'Student Account' : 'Parent Account';
        
        return `
        <section class="settings-section" data-account-id="${account.user_id}">
            <div class="section-header">
                <h3 class="section-title">
                    <i class="fas ${icon}" style="margin-right: 8px; color: var(--primary-color);"></i>
                    ${account.username || 'Account'}
                </h3>
                <div style="display: flex; gap: 8px;">
                    <button class="button-outline edit-account-btn">
                        <i class="fas fa-edit"></i>
                        <span>Edit</span>
                    </button>
                    <button class="button-outline delete-account-btn" style="color: #ef4444; border-color: #ef4444;" data-account-id="${account.user_id}" data-username="${account.username}">
                        <i class="fas fa-trash"></i>
                        <span>Delete</span>
                    </button>
                </div>
            </div>
            <div class="settings-group">
                <div class="setting-item">
                    <div class="setting-info">
                        <label>User ID</label>
                        <p>Unique identifier</p>
                    </div>
                    <div class="setting-value">
                        <span class="display-text">${account.user_id}</span>
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <label>Account Type</label>
                        <p>User role</p>
                    </div>
                    <div class="setting-value">
                        <span class="display-text">${typeLabel}</span>
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <label>Username</label>
                        <p>Display name</p>
                    </div>
                    <div class="setting-value">
                        <span class="display-text account-name-display">${account.username || '-'}</span>
                        <input type="text" class="setting-input account-name-input" value="${account.username || ''}" style="display: none;">
                    </div>
                </div>
                
                ${isStudent && account.email ? `
                <div class="setting-item">
                    <div class="setting-info">
                        <label>Email</label>
                        <p>Account email</p>
                    </div>
                    <div class="setting-value">
                        <span class="display-text">${account.email}</span>
                    </div>
                </div>
                ` : ''}
                
                <div class="setting-item">
                    <div class="setting-info">
                        <label>Password</label>
                        <p>Change password</p>
                    </div>
                    <div class="setting-value">
                        <span class="display-text">••••••••</span>
                        <input type="password" class="setting-input account-password-input" placeholder="Enter new password" style="display: none;">
                    </div>
                </div>
                
                ${isStudent ? `
                <div class="setting-item">
                    <div class="setting-info">
                        <label>Grade Level</label>
                        <p>Current grade</p>
                    </div>
                    <div class="setting-value">
                        <span class="display-text account-grade-display">Grade ${account.grade_level || 9}</span>
                        <select class="setting-select account-grade-select" style="display: none;">
                            ${[7, 8, 9, 10, 11, 12].map(g => 
                                `<option value="${g}" ${g == account.grade_level ? 'selected' : ''}>Grade ${g}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="setting-item">
                    <div class="setting-info">
                        <label>Daily Goal</label>
                        <p>Target study time (minutes)</p>
                    </div>
                    <div class="setting-value">
                        <span class="display-text account-goal-display">${account.daily_goal || 60} minutes</span>
                        <input type="number" class="setting-input account-goal-input" value="${account.daily_goal || 60}" min="30" max="480" style="display: none;">
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="settings-actions account-edit-actions" style="display: none;">
                <button class="button-primary save-account-btn">
                    <i class="fas fa-save"></i>
                    Save Changes
                </button>
                <button class="button-outline cancel-account-btn">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
            </div>
        </section>
        `;
    }).join('');
    
    // Bind edit buttons
    container.querySelectorAll('.edit-account-btn').forEach(btn => {
        btn.addEventListener('click', handleEditAccount);
    });
    
    // Bind delete buttons
    container.querySelectorAll('.delete-account-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteAccount);
    });
    
    container.querySelectorAll('.save-account-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.closest('.settings-section');
            saveAccountSettings(section);
        });
    });
    
    container.querySelectorAll('.cancel-account-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.closest('.settings-section');
            cancelAccountEdit(section);
        });
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
    
    // Password field show/hide confirm - only for parent account
    const parentPasswordInput = document.getElementById('parentNewPassword');
    const parentConfirmItem = document.getElementById('parentConfirmPasswordItem');
    if (parentPasswordInput && parentConfirmItem) {
        parentPasswordInput.addEventListener('input', function(e) {
            // 只控制父账号自己的确认框，且只在父账号编辑模式下
            const parentEditActions = document.getElementById('parentEditActions');
            if (parentEditActions && parentEditActions.style.display !== 'none' && this.value) {
                parentConfirmItem.style.display = 'flex';
            } else {
                parentConfirmItem.style.display = 'none';
            }
        });
    }
    
    // Add account button
    const addAccountBtn = document.getElementById('addAccountBtn');
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', openAccountTypeModal);
    }
    
    // New account form
    const newAccountForm = document.getElementById('newAccountForm');
    if (newAccountForm) {
        newAccountForm.addEventListener('submit', handleCreateAccount);
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
 * Handle edit account button click
 */
function handleEditAccount(e) {
    const section = e.target.closest('.settings-section');
    const editBtn = section.querySelector('.edit-account-btn');
    const isEditing = section.querySelector('.account-edit-actions').style.display !== 'none';
    
    if (isEditing) {
        cancelAccountEdit(section);
    } else {
        enterAccountEditMode(section);
    }
}

/**
 * Enter account edit mode
 */
function enterAccountEditMode(section) {
    const accountId = section.dataset.accountId;
    const account = allAccounts.find(a => a.user_id === accountId);
    const isStudent = account && account.account_type === 'student';
    
    // Hide displays, show inputs
    const nameDisplay = section.querySelector('.account-name-display');
    const nameInput = section.querySelector('.account-name-input');
    if (nameDisplay && nameInput) {
        nameDisplay.style.display = 'none';
        nameInput.style.display = 'block';
    }
    
    // Show password input (find the password setting-item specifically)
    const passwordDisplay = section.querySelector('.account-password-input')?.previousElementSibling;
    const passwordInput = section.querySelector('.account-password-input');
    if (passwordDisplay && passwordInput && passwordDisplay.textContent.includes('••')) {
        passwordDisplay.style.display = 'none';
        passwordInput.style.display = 'block';
    }
    
    if (isStudent) {
        const gradeDisplay = section.querySelector('.account-grade-display');
        const gradeSelect = section.querySelector('.account-grade-select');
        if (gradeDisplay && gradeSelect) {
            gradeDisplay.style.display = 'none';
            gradeSelect.style.display = 'block';
        }
        
        const goalDisplay = section.querySelector('.account-goal-display');
        const goalInput = section.querySelector('.account-goal-input');
        if (goalDisplay && goalInput) {
            goalDisplay.style.display = 'none';
            goalInput.style.display = 'block';
        }
    }
    
    // Show action buttons, change edit button text
    section.querySelector('.account-edit-actions').style.display = 'flex';
    section.querySelector('.edit-account-btn').innerHTML = '<i class="fas fa-times"></i><span>Cancel</span>';
}

/**
 * Cancel account edit mode
 */
function cancelAccountEdit(section) {
    const accountId = section.dataset.accountId;
    const account = allAccounts.find(a => a.user_id === accountId);
    const isStudent = account && account.account_type === 'student';
    
    // Show displays, hide inputs
    const nameDisplay = section.querySelector('.account-name-display');
    const nameInput = section.querySelector('.account-name-input');
    if (nameDisplay && nameInput) {
        nameDisplay.style.display = 'inline';
        nameInput.style.display = 'none';
    }
    
    // Hide password input and show password display
    const passwordDisplay = section.querySelector('.account-password-input')?.previousElementSibling;
    const passwordInput = section.querySelector('.account-password-input');
    if (passwordDisplay && passwordInput && passwordDisplay.textContent.includes('••')) {
        passwordDisplay.style.display = 'inline';
        passwordInput.style.display = 'none';
        passwordInput.value = '';
    }
    
    if (isStudent) {
        const gradeDisplay = section.querySelector('.account-grade-display');
        const gradeSelect = section.querySelector('.account-grade-select');
        if (gradeDisplay && gradeSelect) {
            gradeDisplay.style.display = 'inline';
            gradeSelect.style.display = 'none';
        }
        
        const goalDisplay = section.querySelector('.account-goal-display');
        const goalInput = section.querySelector('.account-goal-input');
        if (goalDisplay && goalInput) {
            goalDisplay.style.display = 'inline';
            goalInput.style.display = 'none';
        }
    }
    
    // Hide action buttons, restore edit button
    section.querySelector('.account-edit-actions').style.display = 'none';
    section.querySelector('.edit-account-btn').innerHTML = '<i class="fas fa-edit"></i><span>Edit</span>';
}

/**
 * Handle delete account button click
 */
async function handleDeleteAccount(e) {
    const accountId = e.currentTarget.dataset.accountId;
    const username = e.currentTarget.dataset.username;
    
    // Use messageModal.confirm for consistent styling
    const confirmed = await window.messageModal.confirm(
        `Are you sure you want to delete the account "${username}"? This action cannot be undone.`,
        'Delete Account',
        { danger: true, confirmText: 'Delete', cancelText: 'Cancel' }
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const response = await fetch(window.getApiUrl('/auth/delete-child'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: accountId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Account deleted successfully', 'success');
            await loadAllAccounts();
        } else {
            showMessage(data.error || 'Failed to delete account', 'error');
        }
    } catch (error) {
        console.error('Failed to delete account:', error);
        showMessage('Failed to delete account', 'error');
    }
}

/**
 * Save account settings
 */
async function saveAccountSettings(section) {
    const accountId = section.dataset.accountId;
    const account = allAccounts.find(a => a.user_id === accountId);
    
    if (!account) return;
    
    const isStudent = account.account_type === 'student';
    const newName = section.querySelector('.account-name-input').value.trim();
    const newPassword = section.querySelector('.account-password-input').value;
    
    // Validation
    if (!newName) {
        showMessage('Name cannot be empty', 'error');
        return;
    }
    
    if (newPassword && newPassword.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    const updates = {
        user_id: accountId,
        username: newName
    };
    
    if (newPassword) {
        updates.password = newPassword;
    }
    
    if (isStudent) {
        const newGrade = parseInt(section.querySelector('.account-grade-select').value);
        const newGoal = parseInt(section.querySelector('.account-goal-input').value);
        
        if (newGoal < 30 || newGoal > 480) {
            showMessage('Daily goal must be between 30 and 480 minutes', 'error');
            return;
        }
        
        updates.grade_level = newGrade;
        updates.daily_goal = newGoal;
    }
    
    try {
        const response = await fetch(window.getApiUrl('/auth/update-student'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Settings saved successfully', 'success');
            await loadAllAccounts();
        } else {
            showMessage(data.error || 'Failed to save settings', 'error');
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
        showMessage('Failed to save settings', 'error');
    }
}

/**
 * Open account type selection modal
 */
function openAccountTypeModal() {
    document.getElementById('accountTypeModal').style.display = 'flex';
}

/**
 * Close account type selection modal
 */
function closeAccountTypeModal() {
    document.getElementById('accountTypeModal').style.display = 'none';
}

/**
 * Open new account form
 */
function openNewAccountForm(accountType) {
    closeAccountTypeModal();
    
    const isStudent = accountType === 'student';
    document.getElementById('newAccountType').value = accountType;
    document.getElementById('newAccountTitle').textContent = isStudent ? 'Create Student Account' : 'Create Parent Account';
    
    // Email field handling
    const emailGroup = document.getElementById('emailGroup');
    const emailInput = document.getElementById('newEmail');
    
    if (isStudent) {
        // 学生账号不需要邮箱
        emailGroup.style.display = 'none';
        emailInput.required = false;
    } else {
        // 家长账号隐藏邮箱字段，自动使用母账号邮箱
        emailGroup.style.display = 'none';
        emailInput.required = false;
        // 自动填充母账号邮箱
        if (parentData && parentData.email) {
            emailInput.value = parentData.email;
        }
    }
    
    // Show/hide grade and goal fields (only for students)
    document.getElementById('gradeGroup').style.display = isStudent ? 'block' : 'none';
    document.getElementById('goalGroup').style.display = isStudent ? 'block' : 'none';
    
    // Reset form
    document.getElementById('newAccountForm').reset();
    document.getElementById('newAccountType').value = accountType;
    
    document.getElementById('newAccountModal').style.display = 'flex';
}

/**
 * Close new account form modal
 */
function closeNewAccountModal() {
    document.getElementById('newAccountModal').style.display = 'none';
    document.getElementById('newAccountForm').reset();
}

/**
 * Handle create account form submission
 */
async function handleCreateAccount(e) {
    e.preventDefault();
    
    const accountType = document.getElementById('newAccountType').value;
    const username = document.getElementById('newUsername').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    
    // Validation
    if (!username) {
        showMessage('Username is required', 'error');
        return;
    }
    
    // Email validation removed - backend auto-fills parent email
    
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    
    const isStudent = accountType === 'student';
    const requestData = {
        username: username,
        password: password,
        account_type: accountType,
        parent_id: parentData.user_id
    };
    
    if (email) {
        requestData.email = email;
    }
    
    if (isStudent) {
        requestData.grade_level = document.getElementById('newGrade').value;
        requestData.daily_goal = parseInt(document.getElementById('newGoal').value);
    }
    
    try {
        const response = await fetch(window.getApiUrl('/auth/create-child'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(`${accountType === 'student' ? 'Student' : 'Parent'} account created successfully`, 'success');
            closeNewAccountModal();
            await loadAllAccounts();
        } else {
            showMessage(data.error || 'Failed to create account', 'error');
        }
    } catch (error) {
        console.error('Failed to create account:', error);
        showMessage('Failed to create account', 'error');
    }
}

/**
 * Show message
 */
function showMessage(message, type = 'info') {
    // Use Utils notification system
    if (window.Utils && window.Utils.showNotification) {
        window.Utils.showNotification(message, type);
    } else if (window.MessageModal && window.MessageModal.show) {
        window.MessageModal.show(message, type);
    } else {
        alert(message);
    }
}
