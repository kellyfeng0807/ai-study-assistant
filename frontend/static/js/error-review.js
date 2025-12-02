// error-review.js

// 安全说明：
// - 题目/正确答案/分析：由 AI 或可信来源生成 → 可信任，不 escape，保留 LaTeX
// - 用户答案：来自用户输入 → 仅转义 HTML 标签，保留换行

let subject = "unknown"; // 全局默认值

// 安全渲染 MathJax：等待 API 就绪后执行
function safeRenderMath(element) {
    if (!window.MathJax) {
        console.warn('MathJax is not loaded. Skipping math rendering.');
        return;
    }

    if (!window.MathJax.startup || !window.MathJax.startup.promise) {
        const script = document.getElementById('MathJax-script');
        if (script) {
            script.addEventListener('load', () => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise([element]).catch(err => {
                        console.warn('MathJax rendering failed:', err);
                    });
                }
            });
        }
        return;
    }

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

function cleanLatexForMathJax(text) {
    if (!text) return '';
    return text
        .replace(/\x0c/g, '')
        .replace(/\\x0crac/g, '\\frac')
        .replace(/\\x0c/g, '');
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
    
    // 首先尝试从服务器获取数据
    try {
        const res = await fetch(`/api/error/get?id=${encodeURIComponent(errorId)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.error) {
                card = data.error;
                subject = card.subject || "unknown";
                console.log("Loaded from server, subject:", subject);
            }
        }
    } catch (err) {
        console.warn('Failed to fetch from server, trying localStorage:', err);
    }

    // 如果服务器没有数据，尝试从 localStorage 获取
    if (!card) {
        const raw = JSON.parse(localStorage.getItem('errorbook_items') || '{}');
        card = raw[errorId];
    }

    if (!card) {
        if (reviewCard) reviewCard.innerHTML = '<p class="empty-state">Error record not found.</p>';
        return;
    }

    /* ---------------------- 渲染题目 ---------------------- */
    const questionEl = document.getElementById('questionContent');
    if (questionEl) {
        questionEl.innerHTML = cleanLatexForMathJax(card.question_text) || '<i>题目内容为空</i>';
        safeRenderMath(questionEl);
    }

    /* ---------------------- 用户答案 ---------------------- */
    const userAnswerEl = document.getElementById('userAnswer');
    if (userAnswerEl) {
        const answerText = card.user_answer || '';
        userAnswerEl.innerHTML = answerText.replace(/\n/g, '<br>');
        safeRenderMath(userAnswerEl);
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
        metaEl.textContent = `Subject: ${card.subject || 'unknown'} • Type: ${card.type || 'unknown'} • Tags: ${tags || 'none'}`;
    }

    /* ---------------------- 标题 ---------------------- */
    const titleEl = document.getElementById('qTitle');
    if (titleEl) titleEl.textContent = card.title || 'Question';

    /* ---------------------- 返回按钮 ---------------------- */
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => window.history.back());

    /* ============================================
     *        Dropzone 拖拽上传
     * ============================================ */
    const dropzone = document.getElementById("redoDropzone");
    const fileInput = document.getElementById("redoFile");
    const previewDiv = document.getElementById("redoPreview");
    const previewImg = document.getElementById("redoPreviewImg");

    if (dropzone && fileInput) {
        // 点击打开文件选择
        dropzone.addEventListener("click", () => fileInput.click());

        // 拖进来改变样式
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });

        // 放下文件
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                fileInput.files = e.dataTransfer.files;
                updatePreview(file);
            }
        });

        // 选择文件后更新预览
        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (file) {
                updatePreview(file);
            }
        });

        function updatePreview(file) {
            const dzText = dropzone.querySelector(".dz-text");
            if (dzText) dzText.textContent = `已选择：${file.name}`;
            
            // 显示预览图
            if (previewDiv && previewImg) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewDiv.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        }
    }

    /* ============================================
     *        清除按钮
     * ============================================ */
    const redoClearBtn = document.getElementById('redoClearBtn');
    if (redoClearBtn && fileInput) {
        redoClearBtn.addEventListener('click', () => {
            fileInput.value = '';
            const dzText = dropzone?.querySelector(".dz-text");
            if (dzText) dzText.textContent = 'Drag & Drop your answer image here';
            if (previewDiv) previewDiv.style.display = 'none';
            if (previewImg) previewImg.src = '';
            const redoResultEl = document.getElementById('redoResult');
            if (redoResultEl) redoResultEl.textContent = '';
        });
    }

    /* =====================================================
     *                重做（redo）功能
     * ===================================================== */
    const redoBtn = document.getElementById('redoBtn');
    const redoResultEl = document.getElementById('redoResult');

    if (redoBtn && fileInput && redoResultEl) {
        redoBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) {
                redoResultEl.textContent = '请先选择图片';
                redoResultEl.className = 'redo-result err';
                return;
            }

            // 读取文件为 base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result;
                
                redoResultEl.textContent = '正在提交...';
                redoResultEl.className = 'redo-result';

                try {
                    const res = await fetch('/api/error/redo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: errorId,
                            redo_answer: base64Data
                        })
                    });
                    const data = await res.json();
                    console.log("Redo response:", data);

                    if (!data.success) {
                        redoResultEl.textContent = `提交失败: ${data.error || '未知错误'}`;
                        redoResultEl.className = 'redo-result err';
                        return;
                    }

                    redoResultEl.textContent = '🎉 答案已提交，已标记为已复习！';
                    redoResultEl.className = 'redo-result ok';

                } catch (err) {
                    console.error('Redo error:', err);
                    redoResultEl.textContent = `提交出错: ${err.message}`;
                    redoResultEl.className = 'redo-result err';
                }
            };
            reader.readAsDataURL(file);
        });
    }

    /* ============================================
     *        折叠/展开正确答案和分析
     * ============================================ */
    document.querySelectorAll('.toggle-details').forEach(btn => {
        btn.addEventListener('click', () => {
            const details = btn.nextElementSibling;
            if (!details) return;

            const isVisible = details.style.display === 'block';
            details.style.display = isVisible ? 'none' : 'block';

            btn.innerHTML = isVisible
                ? '<i class="fas fa-chevron-down"></i> Show Details'
                : '<i class="fas fa-chevron-up"></i> Hide Details';

            // 展开时渲染 MathJax
            if (!isVisible && window.MathJax) {
                MathJax.typesetPromise([details]).catch(console.warn);
            }
        });
    });
});
