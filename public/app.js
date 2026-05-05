let currentPage = 1;
let currentSearch = "";
let currentUserId = null;

function saveToken(token) {
    localStorage.setItem(CONFIG.STORAGE_KEY, token);
    decodeUser(token);
}

function decodeUser(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUserId = payload.userId;
    } catch (e) { currentUserId = null; }
}

function getToken() { return localStorage.getItem(CONFIG.STORAGE_KEY); }

async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = options.headers || {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) logout();
    return response;
}

function showAuth() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    loadQuestions();
}

// Auth
document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const isRegister = !document.getElementById('name-field').classList.contains('hidden');
    const url = isRegister ? CONFIG.ROUTES.REGISTER : CONFIG.ROUTES.LOGIN;
    const body = {
        email: document.getElementById('auth-email').value,
        password: document.getElementById('auth-password').value,
        ...(isRegister && { name: document.getElementById('auth-name').value })
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
        saveToken(data.token);
        showDashboard();
    } else { alert(data.message || 'Auth failed'); }
};

document.getElementById('auth-toggle').onclick = (e) => {
    const nameField = document.getElementById('name-field');
    const isLogin = nameField.classList.contains('hidden');
    nameField.classList.toggle('hidden');
    document.getElementById('auth-title').innerText = isLogin ? 'Register' : 'Login';
    e.target.innerText = isLogin ? ' Login here.' : ' Register here.';
};

function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    currentUserId = null;
    showAuth();
}
document.getElementById('logout-btn').onclick = logout;

async function loadQuestions() {
    const url = `${CONFIG.ROUTES.QUESTIONS}?page=${currentPage}&limit=${CONFIG.QUESTIONS_PER_PAGE}&search=${currentSearch}`;
    const res = await apiFetch(url);
    const result = await res.json();
    
    const list = document.getElementById('questions-list');
    list.innerHTML = '';
    
    result.data.forEach(q => {
        const div = document.createElement('div');
        div.className = 'question-card';
        
        // isOwner show edit/delete
        const isOwner = q.userId === currentUserId;
        
        div.innerHTML = `
            <div class="meta-info">Created by: <strong>${q.userName}</strong></div>
            <h3>
                ${q.question} 
                ${q.solved ? '<span style="color: #28a745; font-size: 0.8em; margin-left: 10px;"><i class="fa fa-check-circle"></i> Solved!</span>' : ''}
            </h3>
            ${q.imageUrl ? `<img src="${q.imageUrl}" class="image-preview">` : ''}
            
            ${!q.solved ? `
            <div style="margin: 15px 0;">
                <input type="text" placeholder="Type your answer..." id="play-input-${q.id}" style="width: 70%; display: inline-block;">
                <button class="btn btn-primary" onclick="playQuestion(${q.id})">Submit Answer</button>
            </div>
            ` : '<p style="color: #666; font-style: italic;">You have successfully answered this question.</p>'}

            ${isOwner ? `
                <div class="admin-controls">
                    <button class="btn btn-edit" onclick="openEditForm(${q.id}, '${q.question.replace(/'/g, "\\'")}', '${q.answer.replace(/'/g, "\\'")}')">Edit</button>
                    <button class="btn btn-danger" onclick="deleteQuestion(${q.id})">Delete</button>
                </div>
            ` : ''}
        `;
        list.appendChild(div);
    });

    document.getElementById('page-info').innerText = `Page ${result.page} of ${result.totalPages}`;
    document.getElementById('prev-btn').disabled = result.page === 1;
    document.getElementById('next-btn').disabled = result.page === result.totalPages || result.totalPages === 0;
}

// Search
document.getElementById('search-btn').onclick = () => {
    currentSearch = document.getElementById('search-input').value;
    currentPage = 1;
    loadQuestions();
};

async function playQuestion(id) {
    const answer = document.getElementById(`play-input-${id}`).value;
    const res = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${id}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
    });
    const data = await res.json();
    if (res.ok) {
        alert(data.correct ? "Correct! 🎉" : `Wrong! The correct answer was: ${data.correctAnswer}`);
        if (data.correct) {
            loadQuestions();
        }
    } else {
        alert(data.message || 'Error submitting answer');
    }
}

// Create amd Edit 
function openEditForm(id = null, text = '', answer = '') {
    document.getElementById('form-section').classList.remove('hidden');
    document.getElementById('form-title').innerText = id ? 'Edit Question' : 'New Question';
    document.getElementById('edit-id').value = id || '';
    document.getElementById('q-text').value = text;
    document.getElementById('q-answer').value = answer;
    document.getElementById('q-image').value = "";
}

document.getElementById('show-create-btn').onclick = () => openEditForm();
document.getElementById('cancel-form-btn').onclick = () => document.getElementById('form-section').classList.add('hidden');

document.getElementById('question-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    
    const formData = new FormData();
    formData.append('question', document.getElementById('q-text').value);
    formData.append('answer', document.getElementById('q-answer').value);
    const file = document.getElementById('q-image').files[0];
    if (file) formData.append('image', file);

    const url = id ? `${CONFIG.ROUTES.QUESTIONS}/${id}` : CONFIG.ROUTES.QUESTIONS;
    const method = id ? 'PUT' : 'POST';

    const res = await apiFetch(url, { method, body: formData });
    if (res.ok) {
        document.getElementById('form-section').classList.add('hidden');
        loadQuestions();
        e.target.reset();
    } else { 
        alert('Operation failed. Make sure your image is valid.'); 
    }
};

// Delete 
async function deleteQuestion(id) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    const res = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${id}`, { method: 'DELETE' });
    if (res.ok) loadQuestions();
}


document.getElementById('prev-btn').onclick = () => { if (currentPage > 1) { currentPage--; loadQuestions(); } };
document.getElementById('next-btn').onclick = () => { currentPage++; loadQuestions(); };


window.onload = () => {
    const token = getToken();
    if (token) { 
        decodeUser(token); 
        showDashboard(); 
    } else { 
        showAuth(); 
    }
};