// error-practice.js

/**
 * 安全转义 HTML 字符串，防止 XSS
 */
let practiceActiveTime = 0;       // 累积活跃时间（毫秒）
let practiceLastStart = Date.now(); // 最近开始活跃的时间
const USER_ID = 0;               // 或者从前端登录信息获取
let subject = "unknown";          // 当前科目，稍后从接口获取

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        practiceActiveTime += Date.now() - practiceLastStart;
    } else if (document.visibilityState === 'visible') {
        practiceLastStart = Date.now();
    }
});

window.addEventListener("beforeunload", () => {
    if (document.visibilityState === 'visible') {
        practiceActiveTime += Date.now() - practiceLastStart;
    }

    const seconds = Math.floor(practiceActiveTime / 1000);
    if (seconds <= 0) return;

    navigator.sendBeacon('/api/track_time', JSON.stringify({
        seconds: seconds,
        mode: "practice",   // ❗ mode 改成 practice
        subject: subject,   // 当前科目
        user_id: USER_ID
    }));
});

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
    container.innerHTML = '<p style="color:red;">Error: Missing question ID.</p>';
    return;
  }

  let originalCard;

  try {
    // ✅ 从数据库获取单条错题
    const res = await fetch(`/api/error/get?id=${encodeURIComponent(errorId)}`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Question not found');
    }
    originalCard = data.error; // 数据库返回的错题对象
    subject = originalCard.subject || "unknown"; // ✅ 更新全局科目

  } catch (err) {
    console.error('Error fetching original question:', err);
    container.innerHTML = `<p style="color:red;">Error fetching question: ${err.message}</p>`;
    return;
  }

  // ✅ 调用接口生成相似题目
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
    console.error('Error generating practice questions:', err);
    container.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
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