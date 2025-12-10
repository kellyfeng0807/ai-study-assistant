// error-practice.js

/**
 * 安全转义 HTML 字符串，防止 XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

/**
 * 渲染相似题目列表
 */
 function renderProblems(problems) {
  const container = document.getElementById('problemsContainer');
  if (!problems || problems.length === 0) {
    container.innerHTML = '<p class="empty-state">No similar questions generated.</p>';
    return;
  }

let html = '';
problems.forEach((prob, idx) => {
  const isFav = prob.in_error_book === 1;
  html += `
    <div class="error-card practice-question" data-practice-id="${prob.id || idx}">
    <!-- Favorite button 放右上角 -->
  <button class="button-outline favorite-practice-btn"
          style="
            position: absolute;
            top: 8px;
            right: 8px;
            ${isFav ? 'background:#ffc107;color:white;' : ''};
          "
          ${isFav ? 'disabled' : ''}>
    ${isFav ? 'In Error Book' : 'Add to Error Book'}
  </button>
      <div class="error-content">
        <h4 class="error-title">Question ${idx + 1}</h4>
        <p class="error-description tex2jax_process">${prob.question_text}</p>
      </div>



      <span class="favorite-status" style="margin-left:8px; font-weight:bold; color:green;"></span>

      <!-- User Answer Panel -->
      <div class="user-answer-panel" style="margin-top:16px; padding-top:16px; border-top:1px dashed var(--border-color);">
        <div class="answer-actions">
          <button class="button-outline toggle-text-input">
            <i class="fas fa-keyboard"></i> Text Answer
          </button>
          <button class="button-outline toggle-image-upload">
            <i class="fas fa-image"></i> Upload Image
          </button>
        </div>

        <!-- Text Input -->
        <div class="text-answer-section" style="display:none; margin-top:10px;">
          <textarea class="form-control text-answer" placeholder="Enter your answer..."
                    data-problem-index="${idx}"></textarea>
          <button type="button" class="submit-text-answer" style="margin-top:5px;">
            Submit Text Answer
            <span class="spinner" style="display:none; margin-left:6px;"></span>
          </button>
        </div>

        <!-- Image Upload -->
        <div class="image-answer-section" style="display:none; margin-top:10px;">
          <input type="file" accept="image/*" class="answer-image-input" data-problem-index="${idx}">
          <button type="button" class="custom-file-btn">Choose Image</button>

          <div class="image-preview" style="display:none; margin-top:8px;">
            <img src="" alt="Preview" style="max-width:200px; max-height:150px; border:1px solid #ddd; border-radius:4px;">
            <button type="button" class="remove-image" style="margin-top:5px; font-size:14px;">×</button>
            <button type="button" class="submit-image-answer" style="margin-top:5px; position:relative;">
              Submit Image Answer
              <span class="spinner" style="display:none; width:16px; height:16px; border:2px solid #ccc; border-top-color:#1e90ff; border-radius:50%; animation: spin 1s linear infinite; position:absolute; right:-24px; top:50%; transform:translateY(-50%);"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Show Standard Answer -->
      <div class="error-footer" style="display:flex; flex-direction:column; align-items:flex-start;">
        <button class="button-outline toggle-answer" data-index="${idx}">
          <i class="fas fa-eye"></i> Show Answer
        </button>

        <div class="answer-section" id="answer-${idx}" style="display:none; width:100%; margin-top:8px;">
          <div class="answer-wrapper">
            <strong>Correct Answer:</strong>
            <div class="answer-content tex2jax_process">${prob.correct_answer}</div>

            ${prob.analysis_steps ? `
              <div style="margin-top:12px;">
                <strong>Analysis:</strong>
                <div class="analysis-content tex2jax_process">${escapeHtml(prob.analysis_steps)}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
});

  container.innerHTML = html;

  // 绑定“显示答案”按钮事件
  document.querySelectorAll('.toggle-answer').forEach(btn => {
    btn.addEventListener('click', function () {
      const idx = this.dataset.index;
      const answerEl = document.getElementById(`answer-${idx}`);
      const isHidden = answerEl.style.display === 'none';

      if (isHidden) {
        answerEl.style.display = 'block';
        this.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Answer';
        // 触发 MathJax 渲染新内容
        if (window.MathJax) {
          MathJax.typesetPromise([answerEl]).catch(console.warn);
        }
      } else {
        answerEl.style.display = 'none';
        this.innerHTML = '<i class="fas fa-eye"></i> Show Answer';
      }
    });
  });

  // 渲染题目中的公式（初始内容）
  if (window.MathJax) {
    MathJax.typesetPromise([container]).catch(console.warn);
  }
}

async function initPracticePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const errorId = urlParams.get('id');

  const container = document.getElementById('problemsContainer');

  if (!errorId) {
    container.innerHTML = '<p>Error: Missing question ID.</p>';
    return;
  }

  try {
    // 从数据库获取原始错题
    const getRes = await fetch(window.getApiUrl(`/api/error/get?id=${encodeURIComponent(errorId)}`));
    if (!getRes.ok) {
      throw new Error('Failed to fetch original question from database');
    }
    
    const getData = await getRes.json();
    const originalCard = getData.error;

    if (!originalCard) {
      container.innerHTML = `<p>Original question not found for ID: ${errorId}</p>`;
      return;
    }

    const response = await fetch(window.getApiUrl('/api/error/practice/generate-similar'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: errorId,
        question_text: originalCard.question_text,
        count: 3
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to generate similar problems');
    }

    renderProblems(result.data?.similar_problems || []);
  } catch (err) {
    console.error('Error loading practice questions:', err);
    container.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
  }
}

// 绑定返回按钮
document.getElementById('backBtn')?.addEventListener('click', () => {
  window.history.back();
});

// 页面加载完成后执行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPracticePage);
} else {
  initPracticePage();
}




//新增
// ===== 答题区交互：文字/图片切换 + 图片预览 =====

document.addEventListener('click', function(e) {
  // 1. 切换到文字输入
  if (e.target.closest('.toggle-text-input')) {
    const card = e.target.closest('.error-card');
    if (card) {
      card.querySelector('.text-answer-section').style.display = 'block';
      card.querySelector('.image-answer-section').style.display = 'none';
    }
    return;
  }

  // 2. 切换到图片上传
  if (e.target.closest('.toggle-image-upload')) {
    const card = e.target.closest('.error-card');
    if (card) {
      card.querySelector('.text-answer-section').style.display = 'none';
      card.querySelector('.image-answer-section').style.display = 'block';
    }
    return;
  }

  // 3. 移除图片预览
  if (e.target.classList.contains('remove-image')) {
    const previewDiv = e.target.closest('.image-preview');
    if (previewDiv) {
      previewDiv.style.display = 'none';
      const input = previewDiv.previousElementSibling; // <input>
      if (input) input.value = '';
    }
    return;
  }
});

// ===== 图片上传预览 =====
document.addEventListener('change', function(e) {
  if (e.target.classList.contains('answer-image-input')) {
    const file = e.target.files[0];
    const previewDiv = e.target.nextElementSibling; // 应该是 .image-preview

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        const img = previewDiv.querySelector('img');
        if (img) {
          img.src = evt.target.result;
          previewDiv.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    } else {
      if (previewDiv) previewDiv.style.display = 'none';
      alert('Please select a valid image file (JPG, PNG, etc.).');
    }
  }
});

const container = document.getElementById('problemsContainer');

// ---------- click 事件 ---------- //
container.addEventListener('click', (e) => {
  const card = e.target.closest('.error-card');
  if (!card) return;

  const practiceId = card.dataset.practiceId;


  // 点击自定义文件按钮
if (e.target.classList.contains('custom-file-btn')) {
  const card = e.target.closest('.error-card');
  const input = card.querySelector('.answer-image-input');
  if (input) input.click(); // 触发文件选择框
  return;
}


  // 切换文字作答
  if (e.target.closest('.toggle-text-input')) {
    card.querySelector('.text-answer-section').style.display = 'block';
    card.querySelector('.image-answer-section').style.display = 'none';
    return;
  }

  // 切换图片作答
  if (e.target.closest('.toggle-image-upload')) {
    card.querySelector('.text-answer-section').style.display = 'none';
    card.querySelector('.image-answer-section').style.display = 'block';
    return;
  }

  // 移除图片
  if (e.target.classList.contains('remove-image')) {
    const previewDiv = e.target.closest('.image-preview');
    previewDiv.style.display = 'none';
    const input = previewDiv.closest('.image-answer-section').querySelector('.answer-image-input');
    if (input) input.value = '';
    return;
  }

  // 提交文字答案
if (e.target.closest('.submit-text-answer')) {
  (async () => {
    const btn = e.target.closest('.submit-text-answer');
    const spinner = btn.querySelector('.spinner');
    if (spinner) spinner.style.display = 'inline-block'; // 显示旋转圈
    btn.disabled = true;

    const textarea = card.querySelector('.text-answer');
    const userAnswer = textarea.value.trim();
    if (!userAnswer) {
      alert('Please enter your answer.');
      if (spinner) spinner.style.display = 'none';
      btn.disabled = false;
      return;
    }

    try {
      const res = await fetch('/api/error/practice/do_text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practice_id: practiceId, user_answer_text: userAnswer })
      });
      const data = await res.json();

      let resultDiv = card.querySelector(".answer-result");
      if (!resultDiv) {
        resultDiv = document.createElement("div");
        resultDiv.className = "answer-result";
        resultDiv.style.marginTop = "8px";
        resultDiv.style.fontWeight = "bold";
        card.appendChild(resultDiv);
      }
      resultDiv.textContent = data.correct ? "Correct ✅" : "Incorrect ❌";

    } catch (err) {
      console.error(err);
      alert('Network error, please try again.');
    } finally {
      if (spinner) spinner.style.display = 'none';
      btn.disabled = false;
    }
  })();
  return;
}

  // 提交图片答案
  // 提交图片答案
if (e.target.closest('.submit-image-answer')) {
  const btn = e.target.closest('.submit-image-answer');
  const spinner = btn.querySelector('.spinner');
  const input = card.querySelector('.answer-image-input');
  const file = input.files[0];
  if (!file) return alert('Please select an image first.');

  spinner.style.display = 'inline-block';  // 显示旋转圈
  btn.disabled = true;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const base64Data = evt.target.result;
    try {
      const res = await fetch('/api/error/practice/do_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practice_id: practiceId, redo_answer: base64Data })
      });
      const data = await res.json();

      let resultDiv = card.querySelector(".answer-result");
      if (!resultDiv) {
        resultDiv = document.createElement("div");
        resultDiv.className = "answer-result";
        resultDiv.style.marginTop = "8px";
        resultDiv.style.fontWeight = "bold";
        card.appendChild(resultDiv);
      }
      resultDiv.textContent = data.is_correct ? "Correct ✅" : "Incorrect ❌";
    } catch (err) {
      console.error(err);
      alert('Network error, please try again.');
    } finally {
      spinner.style.display = 'none'; // 隐藏旋转圈
      btn.disabled = false;
    }
  };
  reader.readAsDataURL(file);
  return;
}


  // 收藏按钮
  if (e.target.classList.contains('favorite-practice-btn')) {
  const btn = e.target;

  (async () => {
    btn.disabled = true;

    try {
      const res = await fetch('/api/error/practice/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practice_id: practiceId })
      });
      const data = await res.json();
      if (data.success) {
        btn.textContent = 'In Error Book';   // ✅ 文字变化
        btn.style.background = '#ffc107';    // ✅ 颜色变化
        btn.style.color = 'white'; 
      } else {
        btn.disabled = false;
        alert('Failed to add to Error Book');
      }
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      alert('Network error');
    }
  })();
}

});

// ---------- 图片预览事件 ---------- //
container.addEventListener('change', (e) => {
  if (!e.target.classList.contains('answer-image-input')) return;
  const file = e.target.files[0];
  const previewDiv = e.target.closest('.image-answer-section').querySelector('.image-preview');
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      previewDiv.querySelector('img').src = evt.target.result;
      previewDiv.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    previewDiv.style.display = 'none';
    alert('Please select a valid image file.');
  }
});


// 点击“重新生成”按钮
document.getElementById('regenerateBtn')?.addEventListener('click', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const errorId = urlParams.get('id');

  if (!errorId) return alert('缺少题目 ID');

  const container = document.getElementById('problemsContainer');
  container.innerHTML = '<p>Regenerating problem…</p>';

  try {
    // 先获取原题文本
    const getRes = await fetch(window.getApiUrl(`/api/error/get?id=${encodeURIComponent(errorId)}`));
    if (!getRes.ok) throw new Error('获取原题失败');
    const getData = await getRes.json();
    const originalCard = getData.error;
    if (!originalCard) throw new Error('原题不存在');

    const res = await fetch('/api/error/practice/generate-similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: errorId,
        question_text: originalCard.question_text,  // ✅ 关键：传原题内容
        correct_answer:originalCard.correct_answer,
        count: 3,
        force: true
      })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || '生成失败');
    }

    // 更新前端显示
    renderProblems(result.data?.similar_problems || []);

  } catch (err) {
    console.error('重新生成错题失败:', err);
    container.innerHTML = `<p style="color:red;">重新生成错题失败: ${err.message}</p>`;
  }
});
