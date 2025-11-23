// error-review.js
// error-review.js

// ⚠️ 安全说明：
// - 题目/正确答案/分析：由 AI 或可信来源生成 → 可信任，不 escape，保留 LaTeX
// - 用户答案：来自用户输入 → 仅转义 HTML 标签，保留换行
// error-review.js
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
/*
function safeRenderMath(element) {
    let retries = 0;
    const maxRetries = 20; // 最多等待 2 秒

    function attempt() {
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([element]).catch(err => {
                console.warn('MathJax rendering failed:', err);
            });
            return;
        }

        retries++;
        if (retries < maxRetries) {
            setTimeout(attempt, 100);
        } else {
            console.warn('MathJax did not become ready within timeout.');
        }
    }

    attempt();
}
*/
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
    safeRenderMath(userAnswerEl); // 👈 关键：加上这行！
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
/*
// 安全转义用户输入（防止 XSS）
function escapeUserInput(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 安全渲染 MathJax：等待 API 就绪后执行
function safeRenderMath(element) {
    let retries = 0;
    const maxRetries = 20; // 最多等待 2 秒 (20 * 100ms)

    function attempt() {
        // 检查 MathJax 是否已加载且 typesetPromise 可用
        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([element]).catch(err => {
                console.warn('MathJax rendering failed:', err);
            });
            return;
        }

        retries++;
        if (retries < maxRetries) {
            setTimeout(attempt, 100); // 每 100ms 重试一次
        } else {
            console.warn('MathJax did not become ready within timeout.');
        }
    }

    attempt();
}

document.addEventListener('DOMContentLoaded', () => {
    // 1️⃣ 获取 URL 中的 id 参数
    const urlParams = new URLSearchParams(window.location.search);
    const errorId = urlParams.get('id');
    if (!errorId) {
        console.warn('未提供错题 id');
        const card = document.getElementById('reviewCard');
        if (card) card.innerHTML = '<p class="empty-state">Invalid review ID.</p>';
        return;
    }

    // 2️⃣ 从 localStorage 获取对应错题
    const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
    const card = raw[errorId];
    if (!card) {
        console.warn(`未找到错题 id=${errorId}`);
        const cardEl = document.getElementById('reviewCard');
        if (cardEl) cardEl.innerHTML = '<p class="empty-state">Error record not found.</p>';
        return;
    }

    // 3️⃣ 渲染题目内容（可信内容，不 escape，支持 LaTeX）
    const questionContentEl = document.getElementById('questionContent');
    if (questionContentEl) {
        questionContentEl.innerHTML = card.question_text || '题目内容为空';
    }

    // 4️⃣ 渲染用户答案（用户输入，需 escape）
    const userAnswerEl = document.getElementById('userAnswer');
    if (userAnswerEl) {
        // 在 error-review.js 中临时改成：
const safeAnswer = card.user_answer || ''; // 不转义！仅用于测试
userAnswerEl.innerHTML = safeAnswer.replace(/\n/g, '<br>');
        //const safeAnswer = escapeUserInput(card.user_answer || '');
        //userAnswerEl.innerHTML = safeAnswer ? safeAnswer.replace(/\n/g, '<br>') : '<i>未填写</i>';
    }

    // 5️⃣ 渲染正确答案（可信内容，不 escape）
    const theAnswerEl = document.getElementById('theAnswer');
    if (theAnswerEl) {
        theAnswerEl.innerHTML = card.correct_answer || '<i>暂无</i>';
    }

    // 6️⃣ 渲染分析步骤（可信内容，不 escape）
    const analysisDiv = document.getElementById('analysisContent');
    if (analysisDiv) {
        if (Array.isArray(card.analysis_steps) && card.analysis_steps.length > 0) {
            let html = '<ol>';
            card.analysis_steps.forEach(step => {
                html += `<li>${step}</li>`; // AI 生成，视为安全
            });
            html += '</ol>';
            analysisDiv.innerHTML = html;
        } else {
            analysisDiv.innerHTML = '<i>暂无分析</i>';
        }
    }

    // 7️⃣ 渲染元信息
    const metaInfoDiv = document.getElementById('metaInfo');
    if (metaInfoDiv) {
        const tags = Array.isArray(card.tags) ? card.tags.join(', ') : '';
        metaInfoDiv.textContent = `科目: ${card.subject || '未知'} • 类型: ${card.type || '未知'} • 标签: ${tags || '无'}`;
    }

    // 8️⃣ 设置标题
    const qTitleEl = document.getElementById('qTitle');
    if (qTitleEl) {
        qTitleEl.textContent = card.title || '错题回顾';
    }

    // 9️⃣ 安全渲染 MathJax 公式
    const reviewCard = document.getElementById('reviewCard');
    if (reviewCard) {
        safeRenderMath(reviewCard);
    }

    // 🔟 返回按钮
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
});
*/
/*
function escapeUserInput(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
    // 1️⃣ 获取 URL 中的 id 参数
    const urlParams = new URLSearchParams(window.location.search);
    const errorId = urlParams.get('id');
    if (!errorId) {
        console.warn('未提供错题 id');
        document.getElementById('reviewCard').innerHTML = '<p class="empty-state">Invalid review ID.</p>';
        return;
    }

    // 2️⃣ 从 localStorage 获取对应错题
    const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
    const card = raw[errorId];
    if (!card) {
        console.warn(`未找到错题 id=${errorId}`);
        document.getElementById('reviewCard').innerHTML = '<p class="empty-state">Error record not found.</p>';
        return;
    }

    // 3️⃣ 渲染题目内容（可信内容，不 escape）
    const questionContentEl = document.getElementById('questionContent');
    if (questionContentEl) {
        questionContentEl.innerHTML = card.question_text || '题目内容为空';
    }

    // 4️⃣ 渲染用户答案（用户输入，需 escape）
    const userAnswerEl = document.getElementById('userAnswer');
    if (userAnswerEl) {
        const safeAnswer = escapeUserInput(card.user_answer || '');
        userAnswerEl.innerHTML = safeAnswer ? safeAnswer.replace(/\n/g, '<br>') : '<i>未填写</i>';
    }

    // 5️⃣ 渲染正确答案（可信内容，不 escape）
    const theAnswerEl = document.getElementById('theAnswer');
    if (theAnswerEl) {
        theAnswerEl.innerHTML = card.correct_answer || '<i>暂无</i>';
    }

    // 6️⃣ 渲染分析步骤（可信内容，不 escape）
    const analysisDiv = document.getElementById('analysisContent');
    if (analysisDiv) {
        if (Array.isArray(card.analysis_steps) && card.analysis_steps.length > 0) {
            let html = '<ol>';
            card.analysis_steps.forEach(step => {
                // 步骤由 AI 生成，视为可信
                html += `<li>${step}</li>`;
            });
            html += '</ol>';
            analysisDiv.innerHTML = html;
        } else {
            analysisDiv.innerHTML = '<i>暂无分析</i>';
        }
    }

    // 7️⃣ 渲染元信息
    const metaInfoDiv = document.getElementById('metaInfo');
    if (metaInfoDiv) {
        const tags = Array.isArray(card.tags) ? card.tags.join(', ') : '';
        metaInfoDiv.textContent = `科目: ${card.subject || '未知'} • 类型: ${card.type || '未知'} • 标签: ${tags || '无'}`;
    }

    // 8️⃣ 设置标题
    const qTitleEl = document.getElementById('qTitle');
    if (qTitleEl) {
        qTitleEl.textContent = card.title || '错题回顾';
    }

    // 9️⃣ MathJax 渲染（安全方式）
if (window.MathJax) {
    // 使用 MathJax 启动完成后的 promise
    MathJax.startup.promise.then(() => {
        const reviewCard = document.getElementById('reviewCard');
        if (reviewCard) {
            return MathJax.typesetPromise([reviewCard]);
        }
    }).catch(err => {
        console.warn('MathJax rendering failed:', err);
    });
} else {
    // 如果 MathJax 没加载（比如网络慢），可以稍后重试或降级显示
    console.log('MathJax not available yet.');
}

    // 🔟 返回按钮
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
});
*/
/*
// ⚡ 工具函数：安全转义 HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\n/g, '<br/>');
}

// DOMContentLoaded 后执行
document.addEventListener('DOMContentLoaded', () => {
    // 1️⃣ 获取 URL 中的 id 参数
    const urlParams = new URLSearchParams(window.location.search);
    const errorId = urlParams.get('id');
    if (!errorId) {
        console.warn('未提供错题 id');
        return;
    }

    // 2️⃣ 从 localStorage 获取对应错题
    const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
    const card = raw[errorId];
    if (!card) {
        console.warn(`未找到错题 id=${errorId}`);
        return;
    }

    // 3️⃣ 渲染题目内容
    const qTitleEl = document.getElementById('qTitle');
    if (qTitleEl) qTitleEl.innerHTML = card.question_text || '题目内容为空';

    // 4️⃣ 渲染用户答案
    const userAnswerEl = document.getElementById('userAnswer');
    if (userAnswerEl) userAnswerEl.innerHTML = escapeHtml(card.user_answer || '<i>未填写</i>');

    // 5️⃣ 渲染正确答案
    const theAnswerEl = document.getElementById('theAnswer');
    if (theAnswerEl) theAnswerEl.innerHTML = escapeHtml(card.correct_answer || '<i>暂无</i>');

    // 6️⃣ 渲染分析步骤
    const analysisDiv = document.getElementById('analysisContent');
    if (analysisDiv) {
        if (Array.isArray(card.analysis_steps) && card.analysis_steps.length > 0) {
            let html = '<ol>';
            card.analysis_steps.forEach(step => {
                html += `<li>${escapeHtml(step)}</li>`;
            });
            html += '</ol>';
            analysisDiv.innerHTML = html;
        } else {
            analysisDiv.innerHTML = '<i>暂无分析</i>';
        }
    }

    // 7️⃣ 渲染其他信息（科目/题型/标签）
    const metaInfoDiv = document.getElementById('metaInfo');
    if (metaInfoDiv) {
        const tags = Array.isArray(card.tags) ? card.tags.join(', ') : '';
        metaInfoDiv.innerHTML = `
            <p>科目: ${card.subject || '未知'} | 类型: ${card.type || '未知'} | 标签: ${tags || '无'}</p>
        `;
    }

    // 8️⃣ MathJax 渲染公式
    if (window.MathJax) {
        MathJax.typesetPromise([document.getElementById('reviewArea')]);
    }

    // 9️⃣ 返回按钮
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }
});
*/