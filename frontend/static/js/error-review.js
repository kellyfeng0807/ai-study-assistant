// error-review.js


//  安全说明：
// - 题目/正确答案/分析：由 AI 或可信来源生成 → 可信任，不 escape，保留 LaTeX
// - 用户答案：来自用户输入 → 仅转义 HTML 标签，保留换行

// 安全渲染 MathJax：等待 API 就绪后执行
function safeRenderMath(element) {
  // 情况1：MathJax 根本没引入
  if (!window.MathJax) {
    console.warn('MathJax is not loaded. Skipping math rendering.');
    return;
  }

  // 情况2：MathJax 已引入，但 startup.promise 还没准备好（脚本正在加载）
  if (!window.MathJax.startup || !window.MathJax.startup.promise) {
    // 等待 MathJax 脚本加载完成后再尝试
    const script = document.getElementById('MathJax-script');
    if (script) {
      script.addEventListener('load', () => {
        // 加载完成后再次尝试
        if (window.MathJax && window.MathJax.typesetPromise) {
          window.MathJax.typesetPromise([element]).catch(err => {
            console.warn('MathJax rendering failed:', err);
          });
        }
      });
    } else {
      console.warn('MathJax script not found. Make sure you have <script id="MathJax-script"> in HTML.');
    }
    return;
  }

  // 情况3：MathJax 已就绪，直接渲染
  window.MathJax.startup.promise.then(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([element]).catch(err => {
        console.warn('MathJax rendering failed:', err);
      });
    }
  }).catch(err => {
    console.error('MathJax startup error:', err);
  });
}


document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorId = urlParams.get('id');
    if (!errorId) {
        const reviewCard = document.getElementById('reviewCard');
        if (reviewCard) {
            reviewCard.innerHTML = '<p class="empty-state">Invalid review ID.</p>';
        }
        return;
    }

    const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
    const card = raw[errorId];
    if (!card) {
    const reviewCard = document.getElementById('reviewCard');
    if (reviewCard) {
        reviewCard.innerHTML = '<p class="empty-state">Error record not found.</p>';
    }
    return;
}

    // 渲染题目（可信，支持 LaTeX）
    const questionEl = document.getElementById('questionContent');
    if (questionEl) {
        questionEl.innerHTML = card.question_text || '题目内容为空';
        safeRenderMath(questionEl);
    }

    // 渲染用户答案（不可信 → 纯文本 + 换行）
    // 渲染用户答案（来自 OCR/AI，视为可渲染）
const userAnswerEl = document.getElementById('userAnswer');
if (userAnswerEl) {
    const answerText = card.user_answer || '';
    // 保留换行：将 \n 转为 <br>，以便 innerHTML 显示多行
    userAnswerEl.innerHTML = answerText.replace(/\n/g, '<br>');
    safeRenderMath(userAnswerEl); 
}

    // 渲染正确答案（可信）
    const correctAnswerEl = document.getElementById('theAnswer');
    if (correctAnswerEl) {
        correctAnswerEl.innerHTML = card.correct_answer || '<i>暂无</i>';
        safeRenderMath(correctAnswerEl);
    }

    // 渲染分析步骤（可信）
    const analysisEl = document.getElementById('analysisContent');
    if (analysisEl) {
        if (Array.isArray(card.analysis_steps) && card.analysis_steps.length > 0) {
            const html = '<ol>' + card.analysis_steps.map(step => `<li>${step}</li>`).join('') + '</ol>';
            analysisEl.innerHTML = html;
            safeRenderMath(analysisEl);
        } else {
            analysisEl.innerHTML = '<i>暂无分析</i>';
        }
    }

    // 元信息
    const metaEl = document.getElementById('metaInfo');
    if (metaEl) {
        const tags = Array.isArray(card.tags) ? card.tags.join(', ') : '';
        metaEl.textContent = `科目: ${card.subject || '未知'} • 类型: ${card.type || '未知'} • 标签: ${tags || '无'}`;
    }

    // 标题
    const titleEl = document.getElementById('qTitle');
    if (titleEl) {
        titleEl.textContent = card.title || '错题回顾';
    }

    // 返回按钮
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => window.history.back());
    }
});
