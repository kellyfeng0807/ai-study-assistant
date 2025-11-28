// error-review.js


//  安全说明：
// - 题目/正确答案/分析：由 AI 或可信来源生成 → 可信任，不 escape，保留 LaTeX
// - 用户答案：来自用户输入 → 仅转义 HTML 标签，保留换行
const USER_ID=1//先这样写
let activeTime = 0;       // 累积活跃时间（毫秒）
let lastStart = Date.now(); // 最近开始活跃的时间
let subject = "unknown"; // 全局默认值

// 页面可见性检测
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        activeTime += Date.now() - lastStart;
    } else if (document.visibilityState === 'visible') {
        lastStart = Date.now();
    }
});

// 页面关闭/刷新时发送活跃时间
window.addEventListener("beforeunload", () => {
    if (document.visibilityState === 'visible') {
        activeTime += Date.now() - lastStart;
    }

    const seconds = Math.floor(activeTime / 1000);
    if (seconds <= 0) return;

    navigator.sendBeacon('/api/track_time', JSON.stringify({
        seconds: seconds,
        mode: "review",
        subject: subject , // subject 是你已有的全局变量
        is_correct: is_correct, // 或者根据你的变量          // 没有 redo 提交，就算 0
        user_id: USER_ID        // 前端全局用户 ID
    }));
});


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

// 安全渲染 MathJax
function safeRenderMath(element) {
    if (!window.MathJax) return;
    if (window.MathJax.startup && window.MathJax.startup.promise) {
        window.MathJax.startup.promise.then(() => {
            window.MathJax.typesetPromise([element]).catch(err => {
                console.warn('MathJax rendering failed:', err);
            });
        }).catch(err => console.error('MathJax startup error:', err));
    } else {
        const script = document.getElementById('MathJax-script');
        if (script) {
            script.addEventListener('load', () => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise([element]).catch(err => console.warn(err));
                }
            });
        }
    }
}

function cleanLatexForMathJax(text) {
    if (!text) return '';
    return text
        .replace(/\x0c/g, '')       // 去掉 OCR 控制字符
        .replace(/\\x0crac/g, '\\frac') // 修复 OCR 换行错误
        .replace(/\\x0c/g, '');     // 冗余控制字符
}


document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorId = urlParams.get('id');
    console.log("errorId from URL:", errorId);

    const reviewCard = document.getElementById('reviewCard');
    if (!errorId) {
        if (reviewCard) reviewCard.innerHTML = '<p class="empty-state">Invalid review ID.</p>';
        return;
    }

    let card;
    try {
        const res = await fetch(`/api/error/get?id=${encodeURIComponent(errorId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.success || !data.error) throw new Error(data.error || 'Record not found');

        card = data.error; // 后端返回 key = "error"
        subject = card.subject || "unknown"; // 当前题目科目
        console.log("当前题目科目:", subject);
    } catch (err) {
        console.error('Error fetching review data:', err);
        if (reviewCard) reviewCard.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
        return;
    }

    /* ---------------------- 渲染题目 ---------------------- */
    const questionEl = document.getElementById('questionContent');
    if (questionEl) {
        questionEl.innerHTML = cleanLatexForMathJax(card.question_text) || '<i>题目内容为空</i>';
        safeRenderMath(questionEl);
    }

    /* ---------------------- 用户答案（纯文本） ---------------------- */
    const userAnswerEl = document.getElementById('userAnswer');
    if (userAnswerEl) {
        const answerText = card.user_answer || '';
        userAnswerEl.innerHTML = answerText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    /* ---------------------- 正确答案 ---------------------- */
    const correctAnswerEl = document.getElementById('theAnswer');
    if (correctAnswerEl) {
        correctAnswerEl.innerHTML = cleanLatexForMathJax(card.correct_answer) || '<i>暂无</i>';
        safeRenderMath(correctAnswerEl);
    }

    /* ---------------------- 分析步骤 ---------------------- */
    const analysisEl = document.getElementById('analysisContent');
    if (analysisEl) {
        if (Array.isArray(card.analysis_steps) && card.analysis_steps.length > 0) {
            const html = '<ol>' +
                card.analysis_steps.map(step => `<li>${cleanLatexForMathJax(step)}</li>`).join('') +
                '</ol>';
            analysisEl.innerHTML = html;
            safeRenderMath(analysisEl);
        } else {
            analysisEl.innerHTML = '<i>暂无分析</i>';
        }
    }

    /* ---------------------- 元信息 ---------------------- */
    const metaEl = document.getElementById('metaInfo');
    if (metaEl) {
        const tags = Array.isArray(card.tags) ? card.tags.join(', ') : '';
        metaEl.textContent = `Subject: ${card.subject || 'unknown'} • Question type: ${card.type || 'unknown'} • Knowledge point: ${tags || 'unknown'}`;
    }

    /* ---------------------- 标题 ---------------------- */
    const titleEl = document.getElementById('qTitle');
    if (titleEl) titleEl.textContent = card.title || 'Question';

    /* ---------------------- 返回按钮 ---------------------- */
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => window.history.back());

/* ============================================
 *        Dropzone 拖拽上传（必须加这一段）
 * ============================================ */
const dropzone = document.getElementById("redoDropzone");
const fileInput = document.getElementById("redoFile");
console.log("redoDropzone =", dropzone, "redoFile =", fileInput);


if (dropzone && fileInput) {

    // 点击 -> 打开文件选择
    dropzone.addEventListener("click", () => fileInput.click());

    // 拖进来改变样式
    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("bg-blue-50", "border-blue-400");
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("bg-blue-50", "border-blue-400");
    });

    // 放下文件
    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("bg-blue-50", "border-blue-400");

        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files; // 塞到 input
            dropzone.querySelector(".dz-text").textContent = `已选择：${file.name}`;
        }
    });

    // 点击选择文件后 UI 更新
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (file) {
            dropzone.querySelector(".dz-text").textContent = `已选择：${file.name}`;
        }
    });
}



    /* =====================================================
     *                新增：重做（redo）功能
     * ===================================================== */
    const redoBtn = document.getElementById('redoBtn');
    const redoFileInput = document.getElementById('redoFile');
    const redoResultEl = document.getElementById('redoResult');

    if (redoBtn && redoFileInput && redoResultEl) {
        redoBtn.addEventListener('click', async () => {
            const file = redoFileInput.files[0];
            if (!file) {
                redoResultEl.textContent = '请先选择图片';
                return;
            }

            const formData = new FormData();
            formData.append('error_id', errorId);
            formData.append('file', file);

            // 调试打印 FormData
            for (let pair of formData.entries()) {
                console.log(`${pair[0]}:`, pair[1]);
            }

            redoResultEl.textContent = '正在提交...';

            try {
                const res = await fetch('/api/error/redo', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                console.log("Redo response:", data);

                if (!data.success) {
                    redoResultEl.textContent = `提交失败: ${data.error || '未知错误'}`;
                    return;
                }

                redoResultEl.textContent =
                    data.is_correct ? '🎉 恭喜，答案正确！' : '答案不正确，请再尝试';

                 // 新增：发送复习/练习统计
        if (data.success) {
            navigator.sendBeacon('/api/track_time', JSON.stringify({
                seconds: Math.floor(activeTime / 1000),
                mode: "review",
                subject: subject,
                is_correct: data.is_correct ? 1 : 0,
                user_id: USER_ID
            }));
            // 重置计时器
            activeTime = 0;
            lastStart = Date.now();
        }

            } catch (err) {
                console.error('Redo error:', err);
                redoResultEl.textContent = `提交出错: ${err.message}`;
            }
        });
    }
    // 折叠/展开正确答案和分析
document.querySelectorAll('.toggle-details').forEach(btn => {
    btn.addEventListener('click', () => {
        const details = btn.nextElementSibling;
        if (!details) return;

        const isVisible = details.style.display === 'block';
        details.style.display = isVisible ? 'none' : 'block';

        // 切换按钮文字
        btn.innerHTML = isVisible
            ? '<i class="fas fa-chevron-down"></i> Show Details'
            : '<i class="fas fa-chevron-up"></i> Hide Details';
    });
     });
});




