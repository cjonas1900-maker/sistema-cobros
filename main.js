const App = {
    state: {
        view: 'home', // 'home' or 'client'
        method: 'yape', // 'yape', 'bcp', 'interbank'
        name: '', 
        data: null,
        avatarUrl: null,
        bannerUrl: null,
        businessInfo: '',
        isUploading: false,
        imgbbKey: localStorage.getItem('imgbb_key') || 'f3e30b730e5523eee98b2310b95cad47' 
    },

    setApiKey(key) {
        this.state.imgbbKey = key;
        localStorage.setItem('imgbb_key', key);
        this.render();
    },

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('d');

        if (dataParam) {
            try {
                const decompressed = LZString.decompressFromEncodedURIComponent(dataParam);
                const raw = JSON.parse(decompressed);
                // Map short keys back to full keys
                this.state.data = {
                    name: raw.n,
                    method: raw.m,
                    avatar: raw.a,
                    banner: raw.b,
                    info: raw.i,
                    fields: raw.f || {}
                };
                this.state.view = 'client';
            } catch (e) {
                console.error("Invalid link", e);
                this.state.view = 'home';
            }
        } else {
            this.state.view = 'home';
        }

        this.render();
    },

    switchMethod(method) {
        // Save name before switching
        const nameInput = document.getElementById('payer-name');
        if (nameInput) this.state.name = nameInput.value;
        
        this.state.method = method;
        this.render();
    },

    handleAvatar(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        this.processImage(file, 300, 300, (base64) => {
            this.uploadToImgBB(base64, (url) => {
                this.state.avatarUrl = url;
                const preview = document.getElementById('avatar-preview');
                preview.style.backgroundImage = `url(${url})`;
                preview.innerHTML = '';
            });
        });
    },

    handleBanner(e) {
        const file = e.target.files[0];
        if (!file) return;

        this.processImage(file, 1000, 400, (base64) => {
            this.uploadToImgBB(base64, (url) => {
                this.state.bannerUrl = url;
                const preview = document.getElementById('banner-preview');
                preview.style.backgroundImage = `url(${url})`;
                preview.innerHTML = 'Banner';
                preview.style.color = 'white';
                preview.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
            });
        });
    },

    uploadToImgBB(base64, callback) {
        this.state.isUploading = true;
        this.render(); // Show loading state if needed
        
        const formData = new FormData();
        formData.append('image', base64);

        fetch(`https://api.imgbb.com/1/upload?key=${this.state.imgbbKey}`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(resData => {
            this.state.isUploading = false;
            if (resData.success) {
                callback(resData.data.url);
            } else {
                const msg = resData.error ? resData.error.message : "Error desconocido";
                alert(`Error de ImgBB: ${msg}\n\nTIP: Es posible que necesites usar tu propia API Key gratuita.`);
            }
            this.render();
        })
        .catch(err => {
            this.state.isUploading = false;
            console.error("Upload failed", err);
            alert("Error de conexión al subir imagen.");
            this.render();
        });
    },

    processImage(file, maxWidth, maxHeight, callback) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL('image/jpeg', 0.85); // High quality
                callback(base64.split(',')[1]); // Only keep the raw base64 data
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    },

    removeImage(type) {
        if (type === 'avatar') {
            this.state.avatarUrl = null;
        } else {
            this.state.bannerUrl = null;
        }
        this.render();
    },

    generateLink() {
        const nameInput = document.getElementById('payer-name').value;
        if (!nameInput) return alert("Ingresa tu nombre");

        // Minified schema: n=name, m=method, a=avatar, b=banner, i=info, f=fields
        const data = {
            n: nameInput,
            m: this.state.method,
            a: this.state.avatarUrl,
            b: this.state.bannerUrl,
            i: document.getElementById('biz-info').value,
            f: {}
        };

        if (this.state.method === 'yape') {
            data.f.number = document.getElementById('yape-number').value;
            if (!data.f.number) return alert("Ingresa el número");
        } else if (this.state.method === 'bcp') {
            data.f.name = document.getElementById('bcp-name').value;
            data.f.account = document.getElementById('bcp-account').value;
            data.f.cci = document.getElementById('bcp-cci').value;
            if (!data.f.account) return alert("Ingresa al menos el número de cuenta");
        } else if (this.state.method === 'interbank') {
            data.f.account = document.getElementById('ibk-account').value;
            data.f.cci = document.getElementById('ibk-cci').value;
            if (!data.f.account) return alert("Ingresa el número de cuenta");
        }

        const jsonStr = JSON.stringify(data);
        const encoded = LZString.compressToEncodedURIComponent(jsonStr);
        const longUrl = `${window.location.origin}${window.location.pathname}?d=${encoded}`;
        
        const resultBox = document.getElementById('result-box');
        const linkInput = document.getElementById('generated-link');
        
        resultBox.style.display = 'flex';
        linkInput.value = "Generando link corto...";
        resultBox.scrollIntoView({ behavior: 'smooth' });

        // Shorten with is.gd (Free & CORS-friendly)
        fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longUrl)}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.shorturl) {
                    linkInput.value = resData.shorturl;
                } else {
                    linkInput.value = longUrl;
                }
            })
            .catch(err => {
                console.error("Shortener failed", err);
                linkInput.value = longUrl;
            });
    },

    copyLink() {
        const linkInput = document.getElementById('generated-link');
        linkInput.select();
        document.execCommand('copy');
        
        const btn = document.getElementById('copy-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '¡Copiado! ✓';
        btn.style.background = '#10B981';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    },

    copyText(text, target) {
        navigator.clipboard.writeText(text).then(() => {
            const original = target.innerHTML;
            target.classList.add('success-msg');
            target.innerText = 'Copiado ✓';
            setTimeout(() => {
                target.classList.remove('success-msg');
                target.innerText = text;
            }, 1000);
        });
    },

    render() {
        const appDiv = document.getElementById('app');
        
        if (this.state.view === 'home') {
            appDiv.innerHTML = `
                <div class="glass-card">
                    <h1>Cobros Pro</h1>
                    <p class="subtitle">Personaliza tus datos de pago y genera un link único para enviar a tus clientes.</p>

                    <div class="form-section">
                        <div class="input-group">
                            <label>Tu Nombre completo</label>
                            <input type="text" id="payer-name" placeholder="Ej. Juan Pérez" value="${this.state.name}" oninput="App.state.name = this.value">
                        </div>

                        <div class="input-group">
                            <label>Foto de Perfil (Opcional)</label>
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <div id="avatar-preview" class="preview-container" style="width: 50px; height: 50px; border-radius: 50%; background: var(--input-bg); border: 1px dashed var(--card-border); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; background-size: cover; background-position: center; background-image: ${this.state.avatarUrl ? `url(${this.state.avatarUrl})` : 'none'};">
                                    ${this.state.avatarUrl ? `<button class="delete-badge" onclick="event.stopPropagation(); App.removeImage('avatar')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>` : (this.state.isUploading ? '⌛' : '+')}
                                </div>
                                <input type="file" id="profile-pic" accept="image/*" style="display: none;" onchange="App.handleAvatar(event)">
                                <button class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.8rem;" onclick="document.getElementById('profile-pic').click()" ${this.state.isUploading ? 'disabled' : ''}>${this.state.isUploading ? 'Subiendo...' : 'Subir Foto'}</button>
                            </div>
                        </div>

                        <div class="input-group">
                            <label>Foto de Banner (Fondo)</label>
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <div id="banner-preview" class="preview-container" style="flex: 1; height: 60px; border-radius: 12px; background: var(--input-bg); border: 1px dashed var(--card-border); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; background-size: cover; background-position: center; background-image: ${this.state.bannerUrl ? `url(${this.state.bannerUrl})` : 'none'};">
                                    ${this.state.bannerUrl ? `<button class="delete-badge" onclick="event.stopPropagation(); App.removeImage('banner')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>` : (this.state.isUploading ? 'Subiendo...' : '+ Subir Banner')}
                                </div>
                                <input type="file" id="banner-pic" accept="image/*" style="display: none;" onchange="App.handleBanner(event)">
                                <button class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.8rem;" onclick="document.getElementById('banner-pic').click()" ${this.state.isUploading ? 'disabled' : ''}>${this.state.isUploading ? 'Subiendo...' : 'Subir Banner'}</button>
                            </div>
                        </div>

                        <div class="input-group">
                            <label>Información del Negocio</label>
                            <textarea id="biz-info" placeholder="Describe tu negocio brevemente..." style="min-height: 80px;" oninput="App.state.businessInfo = this.value">${this.state.businessInfo}</textarea>
                        </div>

                        <div class="input-group">
                            <label>Selecciona método de pago</label>
                            <div class="method-tabs">
                                <button class="method-tab ${this.state.method === 'yape' ? 'active' : ''}" onclick="App.switchMethod('yape')">Yape</button>
                                <button class="method-tab ${this.state.method === 'bcp' ? 'active' : ''}" onclick="App.switchMethod('bcp')">BCP</button>
                                <button class="method-tab ${this.state.method === 'interbank' ? 'active' : ''}" onclick="App.switchMethod('interbank')">Interbank</button>
                            </div>
                        </div>

                        ${this.renderMethodFields()}

                        <button class="btn btn-primary" onclick="App.generateLink()">
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                            Generar Link de Cobro
                        </button>

                        <div id="result-box" class="result-box">
                            <div class="success-msg">
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"></path></svg>
                                Link generado con éxito
                            </div>
                            <div class="link-input-wrap">
                                <input type="text" id="generated-link" readonly>
                                <button id="copy-btn" class="btn btn-primary" onclick="App.copyLink()">Copiar</button>
                            </div>
                            <p style="font-size: 0.75rem; color: var(--text-dim); text-align: center;">Comparte este link por WhatsApp para recibir tus pagos.</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const d = this.state.data;
            appDiv.innerHTML = `
                <div class="glass-card">
                    <div class="banner" style="background-image: ${d.banner ? `url(${d.banner})` : 'none'};"></div>
                    <div class="client-hero">
                        ${d.avatar ? 
                            `<div class="avatar" style="background-image: url(${d.avatar});"></div>` : 
                            `<div class="avatar">${d.name.charAt(0).toUpperCase()}</div>`
                        }
                        <div>
                            <h2 style="margin-bottom: 0.2rem;">${d.name}</h2>
                            <p class="subtitle" style="margin-bottom: 0;">Solicita un pago mediante ${d.method.toUpperCase()}</p>
                        </div>
                        ${d.info ? `<div class="business-info">${d.info}</div>` : ''}
                    </div>

                    <div class="payment-card" style="margin-top: 2rem;">
                        ${this.renderClientFields(d)}
                    </div>

                    <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 1rem;">
                        <button class="btn btn-${d.method}" onclick="App.openApp('${d.method}')">
                            Pagar con ${d.method.charAt(0).toUpperCase() + d.method.slice(1)}
                        </button>
                    </div>
                </div>
            `;
        }
    },

    renderMethodFields() {
        if (this.state.method === 'yape') {
            return `
                <div class="input-group">
                    <label>Número de Yape</label>
                    <input type="tel" id="yape-number" placeholder="Ej. 987654321">
                </div>
            `;
        } else if (this.state.method === 'bcp') {
            return `
                <div class="input-group">
                    <label>Nombre en la Tarjeta</label>
                    <input type="text" id="bcp-name" placeholder="Tu nombre artístico o real">
                </div>
                <div class="input-group">
                    <label>Número de Cuenta</label>
                    <input type="text" id="bcp-account" placeholder="N° de cuenta BCP">
                </div>
                <div class="input-group">
                    <label>CCI (Opcional)</label>
                    <input type="text" id="bcp-cci" placeholder="Código de Cuenta Interbancario">
                </div>
            `;
        } else if (this.state.method === 'interbank') {
            return `
                <div class="input-group">
                    <label>Número de Cuenta</label>
                    <input type="text" id="ibk-account" placeholder="N° de cuenta Interbank">
                </div>
                <div class="input-group">
                    <label>CCI</label>
                    <input type="text" id="ibk-cci" placeholder="Código de Cuenta Interbancario">
                </div>
            `;
        }
    },

    renderClientFields(data) {
        let html = '';
        if (data.method === 'yape') {
            html += `
                <div class="field">
                    <label>NÚMERO YAPE</label>
                    <span class="copy-badge" onclick="App.copyText('${data.fields.number}', this)">${data.fields.number}</span>
                </div>
            `;
        } else if (data.method === 'bcp') {
            if (data.fields.name) {
                html += `
                    <div class="field">
                        <label>NOMBRE EN TARJETA</label>
                        <span class="copy-badge" onclick="App.copyText('${data.fields.name}', this)">${data.fields.name}</span>
                    </div>
                `;
            }
            if (data.fields.account) {
                html += `
                    <div class="field">
                        <label>CUENTA BCP</label>
                        <span class="copy-badge" onclick="App.copyText('${data.fields.account}', this)">${data.fields.account}</span>
                    </div>
                `;
            }
            if (data.fields.cci) {
                html += `
                    <div class="field">
                        <label>CCI</label>
                        <span class="copy-badge" onclick="App.copyText('${data.fields.cci}', this)">${data.fields.cci}</span>
                    </div>
                `;
            }
        } else if (data.method === 'interbank') {
            html += `
                <div class="field">
                    <label>CUENTA INTERBANK</label>
                    <span class="copy-badge" onclick="App.copyText('${data.fields.account}', this)">${data.fields.account}</span>
                </div>
            `;
            if (data.fields.cci) {
                html += `
                    <div class="field">
                        <label>CCI</label>
                        <span class="copy-badge" onclick="App.copyText('${data.fields.cci}', this)">${data.fields.cci}</span>
                    </div>
                `;
            }
        }
        return html;
    },

    openApp(method) {
        const links = {
            yape: 'https://play.google.com/store/apps/details?id=com.bcp.innovacxion.yapeapp&hl=es_PE',
            bcp: 'https://play.google.com/store/apps/details?id=com.bcp.bank.bcp&hl=es',
            interbank: 'https://play.google.com/store/apps/details?id=pe.com.interbank.mobilebanking&hl=es'
        };
        
        if (links[method]) {
            window.open(links[method], '_blank');
        } else {
            alert("Copia los datos y péguelos en tu app bancaria.");
        }
    }
};

window.onload = () => App.init();
window.App = App;
