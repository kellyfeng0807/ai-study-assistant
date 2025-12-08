// error-practice.js

// ========== 时间追踪 ==========
let subject = "unknown";
let startTime = Date.now();
let isTracked = false;

async function trackStudyTime(mode = "practice", isCorrect = 0) {
    if (isTracked) return;
    
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    if (seconds < 5 || seconds > 7200) return;
    
    try {
        await fetch('/api/track_time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seconds: seconds,
                mode: mode,
                subject: subject,
                is_correct: isCorrect
            })
        });
        isTracked = true;
        console.log(`📊 Tracked ${seconds}s for ${subject} (${mode})`);
    } catch (err) {
        console.warn('Failed to track time:', err);
    }
}

window.addEventListener('beforeunload', () => trackStudyTime("practice", 0));
window.addEventListener('pagehide', () => trackStudyTime("practice", 0));

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
    html += `
      <div class="error-card">
        <div class="error-content">
          <h4 class="error-title">Question ${idx + 1}</h4>
          <p class="error-description tex2jax_process">${prob.question}</p>
        </div>
        <div class="error-footer">
          <button class="button-outline toggle-answer" data-index="${idx}">
            <i class="fas fa-eye"></i> Show Answer
          </button>
          <div class="answer-section" id="answer-${idx}" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color);">
            <strong>Answer:</strong>
            <div class="answer-content tex2jax_process">${prob.answer}</div>
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

  // 从 localStorage 获取原始错题
  const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
  const originalCard = raw[errorId];

  if (!originalCard) {
    container.innerHTML = `<p>Original question not found for ID: ${errorId}</p>`;
    console.warn('Available keys in localStorage:', Object.keys(raw));
    return;
  }
  
  // 获取科目信息用于时间追踪
  subject = originalCard.subject || "unknown";

  try {
    const response = await fetch('/api/error/practice/generate-similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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