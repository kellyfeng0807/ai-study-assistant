// error-practice.js

// 优化的 MathJax 渲染：批量渲染和防抖
let renderQueue = [];
let renderTimeout = null;

// Check for practice button reset flag when returning to page
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    const errorIdToReset = sessionStorage.getItem('resetPracticeButton');
    if (errorIdToReset) {
      console.log('Detected deleted error, reloading practice page data');
      sessionStorage.removeItem('resetPracticeButton');
      
      // Reload the page to get fresh data from database
      // This ensures in_error_book flags are up-to-date
      window.location.reload();
    }
  }
});

function queueMathRender(element) {
  if (!window.MathJax || !window.MathJax.typesetPromise) {
    return;
  }
  
  if (element && !renderQueue.includes(element)) {
    renderQueue.push(element);
  }
  
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    if (renderQueue.length > 0) {
      const elements = [...renderQueue];
      renderQueue = [];
      MathJax.typesetPromise(elements).catch(console.warn);
    }
  }, 100);
}

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
    <!-- Favorite button right top-->
  <button class="button-outline favorite-practice-btn"
          data-original-error-id="${prob.error_id || ''}"
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
          <input type="file" accept="image/*" class="answer-image-input" data-problem-index="${idx}" style="display:none;">
          <button class="button-outline upload-image-trigger">
            <i class="fas fa-image"></i> Upload Image
            <span class="spinner" style="display:none; margin-left:6px;"></span>
          </button>
        </div>

        <!-- Text Input -->
        <div class="text-answer-section" style="display:none; margin-top:10px;">
          <textarea class="context-textarea text-answer" placeholder="Enter your answer..."
                    data-problem-index="${idx}" rows="4"></textarea>
          <button type="button" class="submit-text-answer button-primary" style="margin-top:8px;">
            Submit Text Answer
            <span class="spinner" style="display:none; margin-left:6px;"></span>
          </button>
        </div>

        <!-- Image Preview (hidden initially) -->
        <div class="image-preview" style="display:none; margin-top:12px;">
          <img src="" alt="Preview" style="max-width:200px; max-height:150px; border:1px solid #ddd; border-radius:4px;">
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
        // 使用优化的批量渲染
        queueMathRender(answerEl);
      } else {
        answerEl.style.display = 'none';
        this.innerHTML = '<i class="fas fa-eye"></i> Show Answer';
      }
    });
  });

  // 渲染题目中的公式（使用批量渲染）
  queueMathRender(container);
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
      card.querySelector('.image-preview').style.display = 'none';
    }
    return;
  }

  // 2. 点击上传图片按钮 - 直接触发文件选择
  if (e.target.closest('.upload-image-trigger')) {
    const btn = e.target.closest('.upload-image-trigger');
    const card = btn.closest('.error-card');
    const input = card.querySelector('.answer-image-input');
    
    // 隐藏文字输入区
    card.querySelector('.text-answer-section').style.display = 'none';
    
    // 触发文件选择
    if (input) input.click();
    return;
  }

  // 3. 移除图片预览
  if (e.target.closest('.remove-image')) {
    const previewDiv = e.target.closest('.remove-image').parentElement;
    if (previewDiv) {
      previewDiv.style.display = 'none';
      const card = previewDiv.closest('.error-card');
      const input = card.querySelector('.answer-image-input');
      if (input) input.value = '';
    }
    return;
  }
});

// ===== 移除旧的图片预览代码（已经在下面的container事件中处理） =====

const container = document.getElementById('problemsContainer');

// ---------- click 事件 ---------- //
container.addEventListener('click', (e) => {
  const card = e.target.closest('.error-card');
  if (!card) return;

  const practiceId = card.dataset.practiceId;





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
      const res = await fetch(window.getApiUrl('/api/error/practice/do_text'), {
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
      resultDiv.textContent = data.correct ? "Correct" : "Incorrect";
      resultDiv.style.color = data.correct ? "green" : "red";

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
        btn.textContent = 'In Error Book';   // 文字变化
        btn.style.background = '#ffc107';    //  颜色变化
        btn.style.color = 'white'; 
        
        // 通知 error-book 页面刷新列表（跨窗口）
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'refreshErrorList' }, '*');
        }

        // 在同一标签页返回时也能触发刷新：设置 sessionStorage 标记
        try {
          sessionStorage.setItem('refreshErrorList', '1');
        } catch (e) {
          console.warn('sessionStorage not available:', e);
        }
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

// ---------- 图片选择后立即上传 ---------- //
container.addEventListener('change', async (e) => {
  if (!e.target.classList.contains('answer-image-input')) return;
  
  const file = e.target.files[0];
  if (!file) return;
  
  const card = e.target.closest('.error-card');
  const practiceId = card.dataset.practiceId;
  const btn = card.querySelector('.upload-image-trigger');
  const spinner = btn.querySelector('.spinner');
  const previewDiv = card.querySelector('.image-preview');
  
  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file.');
    e.target.value = ''; // 清除无效文件
    return;
  }
  
  // 清除之前的预览图（释放内存）
  const oldImg = previewDiv.querySelector('img');
  if (oldImg && oldImg.src && oldImg.src.startsWith('blob:')) {
    URL.revokeObjectURL(oldImg.src);
  }
  
  // 显示预览
  const reader = new FileReader();
  reader.onload = (evt) => {
    previewDiv.querySelector('img').src = evt.target.result;
    previewDiv.style.display = 'block';
  };
  reader.readAsDataURL(file);
  
  // 立即上传
  btn.disabled = true;
  spinner.style.display = 'inline-block';
  
  const formReader = new FileReader();
  formReader.onload = async (evt) => {
    try {
      const res = await fetch('/api/error/practice/do_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practice_id: practiceId,
          redo_answer: evt.target.result
        })
      });
      const data = await res.json();
      
      // 显示结果
      let resultDiv = card.querySelector('.image-result');
      if (!resultDiv) {
        resultDiv = document.createElement('div');
        resultDiv.className = 'image-result';
        resultDiv.style.marginTop = "10px";
        resultDiv.style.fontWeight = "bold";
        card.appendChild(resultDiv);
      }
      resultDiv.textContent = data.is_correct ? "Correct" : "Incorrect";
      resultDiv.style.color = data.is_correct ? "green" : "red";
    } catch (err) {
      console.error(err);
      alert('Network error, please try again.');
    } finally {
      spinner.style.display = 'none';
      btn.disabled = false;
    }
  };
  formReader.readAsDataURL(file);
});


// 点击“重新生成”按钮
document.getElementById('regenerateBtn')?.addEventListener('click', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const errorId = urlParams.get('id');

  if (!errorId) return alert('missing ID');

  const container = document.getElementById('problemsContainer');
  container.innerHTML = '<p>Regenerating problem…</p>';

  try {
    // 先获取原题文本
    const getRes = await fetch(window.getApiUrl(`/api/error/get?id=${encodeURIComponent(errorId)}`));
    if (!getRes.ok) throw new Error('failed to fetch original question from database');
    const getData = await getRes.json();
    const originalCard = getData.error;
    if (!originalCard) throw new Error('original question not found');

    const res = await fetch('/api/error/practice/generate-similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: errorId,
        question_text: originalCard.question_text,  // 传原题内容
        correct_answer:originalCard.correct_answer,
        count: 3,
        force: true
      })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || 'failed to generate similar problems');
    }

    // 更新前端显示
    renderProblems(result.data?.similar_problems || []);

  } catch (err) {
    console.error('fail to re-generate problems:', err);
    container.innerHTML = `<p style="color:red;">fail to re-generate problems: ${err.message}</p>`;
  }
});