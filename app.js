// ========================================
// VRC改変ログ - Application Logic (Phase 3.5: Admin & Fixes)
// ========================================

class VRCKaibenApp {
  constructor() {
    this.currentPage = 'home';
    this.currentLogId = null;
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentUserName = null;
    this.uploadedImages = [];
    this.selectedTags = [];
    this.customParts = [];
    this.customProblems = [];
    this.customTools = [];
    this.referenceLinks = [];
    this.searchTag = null; // searchTag stored here

    // Data Containers
    this.logs = [];
    this.users = {};
    this.announcements = [];
    this.bookmarks = [];

    // Master Data
    this.avatars = [];
    this.parts = [];
    this.unityVersionOptions = [];
    this.vrcSdkVersionOptions = [];
    this.problemOptions = [];
    this.toolOptions = [];
    this.avatarPresets = [];
    this.labels = {
      unity: 'Unityバージョン',
      sdk: 'SDKバージョン',
      parts: 'パーツ',
      problem: '発生した問題',
      tool: '使用ツール'
    };

    this.init();
  }

  init() {
    try {
      if (!window.firebase) throw new Error("Firebase SDK missing");

      // Initialize Firebase (Compat)
      if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
      }
      this.db = firebase.firestore();
      this.auth = firebase.auth();

      // Listeners
      this.setupAuthListener();
      this.setupDataListeners();

      this.bindEvents();
      this.bindFormEvents(); // Ensure forms are bound
      this.initTheme();
      this.checkAnnouncementStatus();

      // Initial Route
      setTimeout(() => this.handleInitialRoute(), 500);
    } catch (e) {
      console.error(e);
      alert("起動エラー: " + e.message);
    }
  }

  setupAuthListener() {
    this.auth.onAuthStateChanged(async user => {
      if (user) {
        this.currentUser = user.uid;
        this.isLoggedIn = true;

        // Get display name from Firestore
        try {
          const userDoc = await this.db.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            this.currentUserName = userDoc.data().displayName || '名無しさん';
          } else {
            this.currentUserName = user.email?.split('@')[0] || '名無しさん';
          }
        } catch (e) {
          this.currentUserName = '名無しさん';
        }

        this.updateLoginUI();
        this.loadUserBookmarks(user.uid);
      } else {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.currentUserName = null;
        this.updateLoginUI();
        this.bookmarks = [];
      }
      // Re-render based on auth
      const myPageEl = document.getElementById('myPage');
      if (myPageEl && myPageEl.classList.contains('active')) this.renderMyPage();
    });
  }

  setupDataListeners() {
    // 1. Logs
    this.db.collection('logs').orderBy('createdAt', 'desc').onSnapshot(snap => {
      this.logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.calculatePopularTags();
      if (this.currentPage === 'home') this.renderHomePage();
      if (this.currentPage === 'list') this.renderListPage();
    }, e => console.log('Logs sync error', e));

    // 2. Users (Cache for display names)
    this.db.collection('users').onSnapshot(snap => {
      this.users = {};
      snap.docs.forEach(doc => { this.users[doc.id] = doc.data(); });
      if (this.currentPage === 'detail') { const id = this.currentLogId; if (id) this.renderDetailPage(id); } // Refresh detail to show new comments/names
    });

    // 3. Announcements
    this.db.collection('announcements').orderBy('date', 'desc').limit(5).onSnapshot(snap => {
      this.announcements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Update home page if on it
      if (this.currentPage === 'home') this.renderHomePage();
    });

    // 4. Master Data
    this.db.collection('masterData').doc('config').onSnapshot(doc => {
      if (doc.exists) {
        const d = doc.data();
        this.avatars = d.avatars || window.sampleAvatars || [];
        this.parts = d.parts || window.sampleParts || [];
        this.unityVersionOptions = d.unityVersions || window.unityVersionOptions || [];
        this.vrcSdkVersionOptions = d.vrcSdkVersions || window.vrcSdkVersionOptions || [];
        this.problemOptions = d.problemOptions || window.problemOptions || [];
        this.toolOptions = d.toolOptions || window.toolOptions || [];
        this.avatarPresets = d.avatarPresets || window.avatarPresets || []; // Fixed key
        if (d.labels) this.labels = { ...this.labels, ...d.labels };
      } else {
        this.loadSampleDataToMemory();
      }
    });
  }

  loadSampleDataToMemory() {
    this.avatars = window.sampleAvatars || [];
    this.parts = window.sampleParts || [];
    this.unityVersionOptions = window.unityVersionOptions || [];
    this.vrcSdkVersionOptions = window.vrcSdkVersionOptions || [];
    this.problemOptions = window.problemOptions || [];
    this.toolOptions = window.toolOptions || [];
    this.avatarPresets = window.avatarPresets || [];
  }

  async loadUserBookmarks(uid) {
    try {
      const doc = await this.db.collection('users').doc(uid).get();
      if (doc.exists) this.bookmarks = doc.data().bookmarks || [];
    } catch (e) { console.error(e); }
  }

  handleInitialRoute() {
    this.navigateTo('home');
  }

  // Legacy Admin check wrapper
  isAdmin() {
    // Basic check: specific UID if needed, or claim. For now, enable admin for specific UID or just enable logical check?
    // Let's rely on a hardcoded Admin UID for Phase 5 MVP if user provides one, OR just allow anyone named 'admin' (but names are free).
    // Better: Check Firestore 'admins' collection or user field.
    // MVP: If user email is 'admin@vrc.log'
    const u = this.auth.currentUser;
    return u && (u.email === 'admin@vrc.log' || this.users[u.uid]?.role === 'admin');
  }
  saveData(key, val) {
    console.warn('saveData is deprecated for Cloud mode:', key);
  }

  // ========================================
  // Theme Management
  // ========================================

  initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'pop'; // Default to Pop
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'cyber' ? 'pop' : 'cyber';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeIcon(newTheme);
  }

  updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) {
      // Current is Pop -> Show Controller (Switch to Cyber)
      // Current is Cyber -> Show Magic/Brush (Switch to Pop)
      const iconName = theme === 'cyber' ? 'auto_fix_high' : 'sports_esports';
      btn.innerHTML = `<span class="material-icons-round">${iconName}</span>`;
      btn.title = theme === 'cyber' ? 'ポップモードに切り替え' : 'サイバーモードに切り替え';
    }

    // Update Logo
    const logo = document.getElementById('siteLogo');
    if (logo) {
      logo.src = theme === 'cyber' ? 'logo-cyber.png' : 'logo-pop.png';
    }
  }

  closeAnnouncement() {
    const banner = document.getElementById('siteAnnouncement');
    if (banner) {
      banner.style.display = 'none';
      sessionStorage.setItem('announcementClosed', 'true');
    }
  }

  checkAnnouncementStatus() {
    if (sessionStorage.getItem('announcementClosed') === 'true') {
      const banner = document.getElementById('siteAnnouncement');
      if (banner) banner.style.display = 'none';
    }
  }

  // ========================================
  // User Registration & Login
  // ========================================

  checkLoginStatus() {
    this.isLoggedIn = localStorage.getItem('vrc_logged_in') === 'true';
    this.currentUser = localStorage.getItem('vrc_user') || null;
    this.updateLoginUI();
  }

  showAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${mode === 'login' ? '🔑 ログイン' : '📝 新規登録'}</h3>
          <button class="modal-close" onclick="app.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">メールアドレス</label>
            <input type="email" class="form-input" id="authEmail" placeholder="example@email.com">
          </div>
          ${mode === 'register' ? `
          <div class="form-group">
            <label class="form-label">ユーザー名（表示名）</label>
            <input type="text" class="form-input" id="authDisplayName" placeholder="ニックネーム" maxlength="20">
          </div>
          ` : ''}
          <div class="form-group">
            <label class="form-label">パスワード</label>
            <input type="password" class="form-input" id="authPassword" placeholder="パスワード（6文字以上）">
          </div>
          <div id="authError" class="auth-error"></div>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="app.${mode === 'login' ? 'doLogin' : 'doRegister'}()">
              ${mode === 'login' ? 'ログイン' : '登録する'}
            </button>
          </div>
          <div class="auth-switch text-center mt-md">
            ${mode === 'login'
        ? 'アカウントをお持ちでない方は <a href="#" onclick="app.showAuthModal(\'register\')">新規登録</a>'
        : 'すでにアカウントをお持ちの方は <a href="#" onclick="app.showAuthModal(\'login\')">ログイン</a>'
      }
          </div>
          ${mode === 'login' ? '<div class="text-center mt-sm"><a href="#" onclick="app.forgotPassword()" class="text-sm text-muted">パスワードを忘れた場合</a></div>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  closeModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
  }

  async doRegister() {
    const email = document.getElementById('authEmail')?.value?.trim();
    const displayName = document.getElementById('authDisplayName')?.value?.trim() || email?.split('@')[0];
    const password = document.getElementById('authPassword')?.value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) return errorEl.textContent = '入力を確認してください';
    if (password.length < 6) return errorEl.textContent = 'パスワードは6文字以上にしてください';

    try {
      errorEl.textContent = '登録中...';
      const cred = await this.auth.createUserWithEmailAndPassword(email, password);

      // Send email verification
      await cred.user.sendEmailVerification();

      // Create user profile in Firestore
      await this.db.collection('users').doc(cred.user.uid).set({
        email: email,
        displayName: displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.closeModal();
      this.showToast('🎉 登録完了！確認メールを送信しました。メールをご確認ください。', 'success');
    } catch (e) {
      console.error(e);
      errorEl.textContent = this.getAuthErrorMessage(e.code);
    }
  }

  async doLogin() {
    const email = document.getElementById('authEmail')?.value?.trim();
    const password = document.getElementById('authPassword')?.value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) return errorEl.textContent = '入力を確認してください';

    try {
      errorEl.textContent = 'ログイン中...';
      await this.auth.signInWithEmailAndPassword(email, password);
      this.closeModal();
      this.showToast('ログインしました！', 'success');
    } catch (e) {
      console.error(e);
      errorEl.textContent = this.getAuthErrorMessage(e.code);
    }
  }

  getAuthErrorMessage(code) {
    const messages = {
      'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
      'auth/invalid-email': '無効なメールアドレスです',
      'auth/weak-password': 'パスワードが弱すぎます',
      'auth/user-not-found': 'ユーザーが見つかりません',
      'auth/wrong-password': 'パスワードが間違っています',
      'auth/invalid-credential': 'メールアドレスまたはパスワードが間違っています'
    };
    return messages[code] || 'エラーが発生しました';
  }

  login() { this.showAuthModal('login'); }

  async logout() {
    try {
      await this.auth.signOut();
      this.showToast('ログアウトしました', 'info');
      this.navigateTo('home');
    } catch (e) { console.error(e); }
  }

  updateLoginUI() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      if (this.isLoggedIn) {
        loginBtn.innerHTML = `<span>👤 ${this.currentUserName || '名無し'}</span>`;
        loginBtn.onclick = () => { if (confirm('ログアウトしますか？')) this.logout(); };
      } else {
        loginBtn.innerHTML = '🔑 ログイン';
        loginBtn.onclick = () => this.login();
      }
    }

    // MyPage Link Visibility
    const mp = document.getElementById('navMyPage');
    if (mp) mp.style.display = this.isLoggedIn ? 'inline-block' : 'none';

    // Admin Link Visibility
    const adminLink = document.querySelector('.footer-link');
    if (adminLink) {
      adminLink.style.display = this.isAdmin() ? 'inline-block' : 'none';
      if (this.isAdmin()) { // Add click handler for SPA nav
        adminLink.onclick = (e) => { e.preventDefault(); this.navigateTo('admin'); };
      }
    }
  }

  // ========================================
  // Navigation
  // ========================================

  navigateTo(page, param = null) {
    this.currentPage = page;
    this.currentLogId = param;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active');

    this.renderPage(page, param);
    window.scrollTo(0, 0);
  }

  renderPage(page, param) {
    switch (page) {
      case 'home': this.renderHomePage(); break;
      case 'list': this.renderListPage(); break;
      case 'detail': this.renderDetailPage(param); break;
      case 'post': this.renderPostPage(); break;
      case 'myPage': this.renderMyPage(); break;
      case 'admin': this.renderAdminPage(); break;
      case 'terms': this.renderTermsPage(); break;
      case 'privacy': this.renderPrivacyPage(); break;
    }
  }

  showPage(page) {
    // For static pages like terms/privacy
    this.navigateTo(page);
  }

  renderTermsPage() {
    const container = document.getElementById('logDetail');
    container.innerHTML = `
      <div class="static-page card">
        <h1>📜 利用規約</h1>
        <p class="text-muted">最終更新: 2026年1月</p>
        <hr>
        
        <h2>第1条（適用）</h2>
        <p>この利用規約（以下、「本規約」といいます。）は、VRChat改変ログ（以下、「当サービス」といいます。）の利用条件を定めるものです。登録ユーザーの皆さま（以下、「ユーザー」といいます。）には、本規約に従って、当サービスをご利用いただきます。</p>
        
        <h2>第2条（利用登録）</h2>
        <ol>
          <li>登録希望者が当サービスの定める方法によって利用登録を申請し、当サービスがこれを承認することによって、利用登録が完了するものとします。</li>
          <li>当サービスは、以下の事由がある場合、利用登録を承認しないことがあります。
            <ul>
              <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
              <li>本規約に違反したことがある者からの申請である場合</li>
              <li>その他、当サービスが利用登録を相当でないと判断した場合</li>
            </ul>
          </li>
        </ol>
        
        <h2>第3条（ユーザーIDおよびパスワードの管理）</h2>
        <ol>
          <li>ユーザーは、自己の責任において、当サービスのユーザーIDおよびパスワードを適切に管理するものとします。</li>
          <li>ユーザーは、いかなる場合にも、ユーザーIDおよびパスワードを第三者に譲渡または貸与することはできません。</li>
        </ol>
        
        <h2>第4条（コンテンツの投稿）</h2>
        <ol>
          <li>ユーザーは、投稿するコンテンツについて、自らが投稿する適法な権利を有していること、および第三者の権利を侵害していないことを保証するものとします。</li>
          <li>ユーザーは、投稿コンテンツについて、当サービスに対し、非独占的な使用、複製、配布に関するライセンスを付与します。</li>
        </ol>
        
        <h2>第5条（禁止事項）</h2>
        <p>ユーザーは、当サービスの利用にあたり、以下の行為をしてはなりません。</p>
        <ol>
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為に関連する行為</li>
          <li>著作権、商標権等の知的財産権を侵害する行為</li>
          <li>サーバーまたはネットワークの機能を妨害する行為</li>
          <li>他のユーザーへの嫌がらせ・誹謗中傷</li>
          <li>不正アクセスまたはその試み</li>
          <li>その他、当サービスが不適切と判断する行為</li>
        </ol>
        
        <h2>第6条（免責事項）</h2>
        <ol>
          <li>当サービスは、本サービスに関して、ユーザーに生じたいかなる損害についても責任を負いません。</li>
          <li>当サービスは、ユーザー間で生じた紛争について一切責任を負いません。</li>
        </ol>
        
        <h2>第7条（サービス内容の変更等）</h2>
        <p>当サービスは、ユーザーへの事前の告知をもって、本サービスの内容を変更または廃止することがあります。</p>
        
        <h2>第8条（利用規約の変更）</h2>
        <p>当サービスは、必要と判断した場合には、ユーザーの同意を得ることなく本規約を変更することができます。</p>
        
        <h2>第9条（準拠法・裁判管轄）</h2>
        <p>本規約の解釈にあたっては、日本法を準拠法とします。</p>
        
        <button class="btn btn-secondary mt-lg" onclick="app.navigateTo('home')">← ホームに戻る</button>
      </div>
    `;
    document.getElementById('page-detail').classList.add('active');
  }

  renderPrivacyPage() {
    const container = document.getElementById('logDetail');
    container.innerHTML = `
      <div class="static-page card">
        <h1>🔒 プライバシーポリシー</h1>
        <p class="text-muted">最終更新: 2026年1月</p>
        <hr>
        
        <h2>第1条（個人情報）</h2>
        <p>「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、特定の個人を識別できる情報を指します。</p>
        
        <h2>第2条（個人情報の収集方法）</h2>
        <p>当サービスは、ユーザーが利用登録をする際にメールアドレス等の情報をお尋ねすることがあります。</p>
        
        <h2>第3条（個人情報を収集・利用する目的）</h2>
        <p>当サービスが個人情報を収集・利用する目的は、以下のとおりです。</p>
        <ol>
          <li>当サービスのサービスの提供・運営のため</li>
          <li>ユーザーからのお問い合わせに回答するため</li>
          <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
          <li>利用規約に違反したユーザーの特定・利用お断りのため</li>
          <li>ユーザーにご自身の登録情報の閲覧や変更を行っていただくため</li>
        </ol>
        
        <h2>第4条（個人情報の第三者提供）</h2>
        <p>当サービスは、法令で認められる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。</p>
        
        <h2>第5条（個人情報の開示）</h2>
        <p>当サービスは、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。</p>
        
        <h2>第6条（個人情報の訂正および削除）</h2>
        <p>ユーザーは、当サービスの保有する自己の個人情報が誤った情報である場合には、訂正または削除を請求することができます。</p>
        
        <h2>第7条（プライバシーポリシーの変更）</h2>
        <p>本ポリシーの内容は、ユーザーに通知することなく、変更することができるものとします。</p>
        
        <h2>第8条（お問い合わせ窓口）</h2>
        <p>本ポリシーに関するお問い合わせは、TwitterのDMまたはお問い合わせフォームよりお願いいたします。</p>
        
        <button class="btn btn-secondary mt-lg" onclick="app.navigateTo('home')">← ホームに戻る</button>
      </div>
    `;
    document.getElementById('page-detail').classList.add('active');
  }

  // ========================================
  // Search Logic (Improved)
  // ========================================

  searchLogs(keyword) {
    if (!keyword) return this.logs;
    const lowerKey = keyword.toLowerCase();

    return this.logs.filter(log => {
      const avatar = this.avatars.find(a => a.id === log.avatarId);
      const parts = log.partsIds.map(id => this.parts.find(p => p.id === id)).filter(Boolean);

      // Cross-search fields
      const searchableText = [
        log.title,
        log.solution,
        log.customAvatarName,
        avatar ? avatar.name : '',
        parts.map(p => p.name).join(' '),
        (log.customPartsNames || []).join(' '),
        (log.tags || []).join(' '),
        (log.problems || []).join(' '),
        (log.tools || []).join(' ')
      ].join(' ').toLowerCase();

      return searchableText.includes(lowerKey);
    });
  }

  // ========================================
  // Pages
  // ========================================

  renderHomePage() {
    // Render Announcements
    const annContainer = document.getElementById('homeAnnouncements');
    if (annContainer && this.announcements && this.announcements.length > 0) {
      // Filter latest 3
      const latest = this.announcements.slice(0, 3);
      annContainer.innerHTML = `
         <div class="announcement-bar">
            ${latest.map(a => `
              <div class="announcement-item ${a.level}">
                 <span class="badge ${a.level === 'important' ? 'badge-danger' : 'badge-primary'}">${a.level === 'important' ? '重要' : 'Info'}</span>
                 <span class="announcement-date">${a.date}</span>
                 <span class="announcement-text">${this.escapeHtml(a.text)}</span>
              </div>
            `).join('')}
         </div>
       `;
    } else if (annContainer) {
      annContainer.innerHTML = '';
    }

    // Populate dropdowns
    // Use dynamic labels if available
    const avatarLabel = (this.labels && this.labels.avatar) || 'アバター';
    const partsLabel = (this.labels && this.labels.parts) || 'パーツ';

    const avatarSelect = document.getElementById('searchAvatar');
    if (avatarSelect) avatarSelect.innerHTML = `<option value="">すべての${this.escapeHtml(avatarLabel)}</option>` + this.avatars.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

    const partsSelect = document.getElementById('searchParts');
    if (partsSelect) partsSelect.innerHTML = `<option value="">すべての${this.escapeHtml(partsLabel)}</option>` + this.parts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Dynamic Tags with Trending Highlight
    const popularTags = this.calculatePopularTags();
    const tagsContainer = document.getElementById('popularTags');
    if (tagsContainer) {
      const tagsToShow = popularTags.length > 0 ? popularTags : window.sampleData.popularTags.slice(0, 5);
      tagsContainer.innerHTML = tagsToShow
        .map((tag, i) => `<span class="tag-chip ${i < 3 ? 'trending' : ''}" onclick="app.searchByTag('${tag}')">${i < 3 ? '<span class="material-icons-round">local_fire_department</span>' : ''}${tag}</span>`)
        .join('');
    }

    this.renderLogCards('recentLogs', this.logs.slice(0, 6));

    // Render Ranking
    this.renderRanking('weekly');
  }

  switchRankingTab(period) {
    document.querySelectorAll('.ranking-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    this.renderRanking(period);
  }

  renderRanking(period) {
    const container = document.getElementById('rankingList');
    if (!container) return;

    const now = new Date();
    let cutoffDate;
    if (period === 'weekly') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Filter and sort by likes
    let rankedLogs = this.logs
      .filter(log => new Date(log.createdAt) >= cutoffDate)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 10);

    if (rankedLogs.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-lg">データがありません</div>';
      return;
    }

    container.innerHTML = rankedLogs.map((log, i) => `
      <div class="ranking-item" onclick="app.navigateTo('detail', '${log.id}')">
        <span class="ranking-position ${i < 3 ? 'top' : ''}">${i + 1}</span>
        <div class="ranking-info">
          <div class="ranking-title">${this.escapeHtml(log.title)}</div>
          <div class="ranking-meta">
            <span><span class="material-icons-round">favorite</span> ${log.likes || 0}</span>
            <span><span class="material-icons-round">visibility</span> ${log.views || 0}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  renderListPage(filters = {}) {
    let filteredLogs = [...this.logs];

    // Filter Logic
    if (filters.keyword) {
      filteredLogs = this.searchLogs(filters.keyword);
    }
    if (filters.beginnerOnly) {
      filteredLogs = filteredLogs.filter(log => log.difficulty === 'beginner');
    }
    if (filters.noProblems) {
      filteredLogs = filteredLogs.filter(log => log.problems.length === 1 && log.problems[0] === '特になし');
    }
    if (filters.avatarId) {
      const selectedAvatar = this.avatars.find(a => a.id === filters.avatarId);
      filteredLogs = filteredLogs.filter(log => {
        // Match by avatarId OR by customAvatarName matching the selected avatar's name
        if (log.avatarId === filters.avatarId) return true;
        if (selectedAvatar && log.customAvatarName && log.customAvatarName.includes(selectedAvatar.name)) return true;
        return false;
      });
    }
    if (filters.partsId) {
      filteredLogs = filteredLogs.filter(log => log.partsIds.includes(filters.partsId));
    }
    if (filters.tag) {
      filteredLogs = filteredLogs.filter(log => log.tags && log.tags.includes(filters.tag));
    }
    if (filters.bookmarked) {
      filteredLogs = filteredLogs.filter(log => this.bookmarks.includes(log.id));
    }

    // UI Updates
    const tagDisplay = document.getElementById('currentTagFilter');
    if (tagDisplay) {
      tagDisplay.innerHTML = filters.tag
        ? `<span class="tag-filter-active">${filters.tag} <button onclick="app.clearTagFilter()">×</button></span>`
        : '';
    }

    document.getElementById('filterBookmark')?.classList.toggle('active', !!filters.bookmarked);

    this.renderLogCards('logList', filteredLogs);

    // Empty state
    const container = document.getElementById('logList');
    if (filteredLogs.length === 0 && container) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><p>条件に一致する改変ログが見つかりませんでした</p></div>`;
    }
  }

  renderLogCards(containerId, logs) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><p>ログが見つかりません</p></div>`;
      return;
    }

    container.innerHTML = logs.map(log => this.createLogCard(log)).join('');
  }

  createLogCard(log) {
    const avatarName = this.getAvatarName(log.avatarId) || log.customAvatarName || 'Unknown';
    const dateStr = new Date(log.createdAt).toLocaleDateString();

    // Star rating
    const stars = '★'.repeat(log.successRate) + '☆'.repeat(5 - log.successRate);

    // Tags
    const tagsHtml = (log.tags || []).slice(0, 3).map(tag => `<span class="tag-chip text-xs">${tag}</span>`).join('');

    // User name (cache lookup)
    const userName = log.guestName || this.users[log.userId]?.displayName || '不明なユーザー';

    // Difficulty badge class
    const diffClass = {
      'beginner': 'badge-success',
      'intermediate': 'badge-warning',
      'advanced': 'badge-danger'
    }[log.difficulty] || 'badge-secondary';

    const diffLabel = {
      'beginner': '初心者向け',
      'intermediate': '中級者向け',
      'advanced': '上級者向け'
    }[log.difficulty] || 'その他';

    // Image logic - prefer isThumbnail marked image, fallback to first image
    let thumbnailImage = null;
    if (log.images && log.images.length > 0) {
      thumbnailImage = log.images.find(img => img.isThumbnail) || log.images[0];
    }
    const thumbnailUrl = thumbnailImage ? thumbnailImage.dataUrl : null;
    const thumbnailHtml = thumbnailUrl
      ? `<div class="log-card-thumbnail"><img src="${thumbnailUrl}" alt=""></div>`
      : `<div class="log-card-thumbnail placeholder"><span class="material-icons-round">image</span></div>`;

    return `
      <div class="log-card" onclick="app.navigateTo('detail', '${log.id}')">
        ${thumbnailHtml}
        <div class="log-card-body">
          <div class="log-card-header">
             <span class="badge ${diffClass}">${diffLabel}</span>
             <span class="text-xs text-muted">${dateStr}</span>
          </div>
          <h3 class="log-card-title">${this.escapeHtml(log.title)}</h3>
          <div class="log-card-meta">
            <div><span class="material-icons-round text-xs">person</span> ${this.escapeHtml(userName)}</div>
            <div><span class="material-icons-round text-xs">checkroom</span> ${this.escapeHtml(avatarName)}</div>
          </div>
          <div class="log-card-rating text-warning">${stars}</div>
          <div class="log-card-tags mt-xs">
            ${tagsHtml}
          </div>
          
          <div class="log-card-footer">
             <div class="log-stat heart">
                <span class="material-icons-round">favorite</span>
                <span class="log-stat-value">${log.likes || 0}</span>
             </div>
             <div class="log-stat view">
                <span class="material-icons-round">visibility</span>
                <span class="log-stat-value">${log.views || 0}</span>
             </div>
          </div>
        </div>
      </div>
    `;
  }

  getAvatarName(id) {
    const a = this.avatars.find(x => x.id === id);
    return a ? a.name : null;
  }

  renderPostPage() {
    // Optional login check
    this.checkLoginForPage('postForm', '投稿', true);

    // Reset inputs
    this.uploadedImages = [];
    this.selectedTags = [];
    this.customParts = [];
    this.customProblems = [];
    this.referenceLinks = [];
    this.customTools = [];

    const container = document.getElementById('postForm');
    container.innerHTML = `
      <form id="logForm" class="card" style="padding: var(--space-xl);">
        <h2 class="section-title"><span class="section-title-icon">📝</span>新しい改変ログを投稿</h2>
        
        <div class="form-group">
          <label class="form-label">タイトル <span class="form-required">*</span></label>
          <input type="text" class="form-input" id="logTitle" placeholder="例: 舞夜にふわふわワンピースを着せてみた" required>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">アバター <span class="form-required">*</span></label>
            <select class="form-select" id="logAvatar" required>
              <option value="">選択してください</option>
              ${this.avatars.map(a => `<option value="${a.id}">${a.name} (${a.creator})</option>`).join('')}
              <option value="その他">その他（自由入力）</option>
            </select>
            <input type="text" class="form-input mt-sm" id="logAvatarCustom" placeholder="アバター名を入力" style="display: none;" list="avatarPresetsList">
            <datalist id="avatarPresetsList">
              ${this.avatarPresets.map(p => `<option value="${p}">`).join('')}
            </datalist>
          </div>
          
          <div class="form-group">
            <label class="form-label">${this.labels.parts || 'パーツ'}（複数選択可）</label>
            <div class="form-checkbox-group" id="partsCheckboxes">
              ${this.parts.map(p => `
                <span class="form-checkbox-item">
                  <input type="checkbox" id="part_${p.id}" value="${p.id}">
                  <label for="part_${p.id}">${p.name}</label>
                </span>
              `).join('')}
            </div>
            <div class="custom-input-row mt-sm">
              <input type="text" class="form-input" id="customPartsInput" placeholder="その他のパーツ...">
              <button type="button" class="btn btn-secondary btn-sm" onclick="app.addCustomPart()">＋追加</button>
            </div>
            <div class="custom-items" id="customPartsList"></div>
          </div>
        </div>

        <div class="form-group">
            <label class="form-label">${this.labels.tool || '使用ツール'}</label>
            <div class="form-checkbox-group">
                ${this.toolOptions.map((tool, idx) => `
                    <span class="form-checkbox-item">
                        <input type="checkbox" id="tool_${idx}" value="${tool}" name="tools">
                        <label for="tool_${idx}">${tool}</label>
                    </span>
                `).join('')}
            </div>
            <div class="custom-input-row mt-sm">
              <input type="text" class="form-input" id="customToolInput" placeholder="その他のツール...">
              <button type="button" class="btn btn-secondary btn-sm" onclick="app.addCustomTool()">＋追加</button>
            </div>
            <div class="custom-items" id="customToolsList"></div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
            <label class="form-label">${this.labels.unity || 'Unityバージョン'}</label>
            <select class="form-select" id="logUnity">
              ${this.unityVersionOptions.map(v => `<option value="${v}" ${v === '2022.3.22f1' ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <input type="text" class="form-input mt-sm" id="logUnityCustom" placeholder="バージョン入力" style="display: none;">
          </div>
          <div class="form-group">
            <label class="form-label">${this.labels.sdk || 'VRC SDKバージョン'}</label>
            <select class="form-select" id="logSdk">
              ${this.vrcSdkVersionOptions.map(v => `<option value="${v}" ${v === '3.5.2' ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
            <input type="text" class="form-input mt-sm" id="logSdkCustom" placeholder="バージョン入力" style="display: none;">
          </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">難易度</label>
                <select class="form-select" id="logDifficulty">
                    <option value="beginner">🌱 初心者OK</option>
                    <option value="intermediate">🌿 中級者向け</option>
                    <option value="advanced">🌳 上級者向け</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">成功度</label>
                <div class="star-input" id="starInput">
                    ${[1, 2, 3, 4, 5].map(i => `<span class="star" data-value="${i}">☆</span>`).join('')}
                </div>
                <input type="hidden" id="logSuccess" value="3">
            </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">${this.labels.problem || '発生した問題'}</label>
          <div class="form-checkbox-group" id="problemCheckboxes">
            ${this.problemOptions.map((p, idx) => `
              <span class="form-checkbox-item">
                <input type="checkbox" id="problem_${idx}" value="${p}">
                <label for="problem_${idx}">${p}</label>
              </span>
            `).join('')}
          </div>
          <div class="custom-input-row mt-sm">
            <input type="text" class="form-input" id="customProblemInput" placeholder="その他の問題...">
            <button type="button" class="btn btn-secondary btn-sm" onclick="app.addCustomProblem()">＋追加</button>
          </div>
          <div class="custom-items" id="customProblemsList"></div>
        </div>
        
        <div class="form-group">
          <label class="form-label">解決方法・コメント <span class="form-required">*</span></label>
          <textarea class="form-textarea" id="logSolution" placeholder="解決方法や手順を記入してください" required></textarea>
        </div>

        <div class="form-group">
            <label class="form-label">参考リンク</label>
            <div class="custom-input-row">
                <input type="url" class="form-input" id="referenceLinkInput" placeholder="https://...">
                <button type="button" class="btn btn-secondary btn-sm" onclick="app.addReferenceLink()">＋追加</button>
            </div>
            <ul class="link-list mt-sm" id="referenceLinksList"></ul>
        </div>

        <div class="form-group">
          <label class="form-label">タグ</label>
          <div class="tag-input-container">
            <input type="text" class="form-input" id="logTagInput" placeholder="#タグを入力してEnter">
            <div class="selected-tags" id="selectedTags"></div>
          </div>
          <div class="popular-tags-hint mt-sm">
            人気タグ: ${this.calculatePopularTags().slice(0, 5).map(t => `<span class="tag-hint" onclick="app.addTag('${t}')">${t}</span>`).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">スクリーンショット</label>
          <div class="image-upload-area" id="imageUploadArea">
            <input type="file" id="imageInput" accept="image/*" multiple style="display: none;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('imageInput').click()">📷 画像を選択</button>
            <span class="upload-hint">またはドラッグ&ドロップ</span>
          </div>
          <div class="custom-input-row mt-sm">
             <input type="text" class="form-input" id="imageUrlInput" placeholder="https://... (画像URL)">
             <button type="button" class="btn btn-secondary btn-sm" onclick="app.addImageUrl()">＋追加</button>
          </div>
          <div class="image-preview-grid" id="imagePreviewGrid"></div>
        </div>
        
        <div class="text-center mt-lg">
          <button type="submit" class="btn btn-primary btn-lg">✨ 投稿する</button>
        </div>
      </form>
    `;

    this.bindFormEvents();
  }

  // ========================================
  // Admin Page (New)
  // ========================================

  renderAdminPage() {
    if (!this.checkLoginForPage('adminContent', '管理者設定')) return;

    if (!this.isAdmin()) {
      const container = document.getElementById('adminContent');
      container.innerHTML = `
            <div class="login-notice">
                <div class="login-notice-icon">🚫</div>
                <h3 class="login-notice-title">アクセス権限がありません</h3>
                <p class="login-notice-text">このページは管理者専用です。</p>
                <button class="btn btn-secondary" onclick="app.navigateTo('home')">ホームに戻る</button>
            </div>`;
      return;
    }

    const container = document.getElementById('adminContent');
    container.innerHTML = `
      ${this.renderAdminDashboardHTML()}
      ${this.renderAnnouncementsHTML()}
      ${this.renderMasterDataHTML()}
      ${this.renderUserManagementHTML()}
      ${this.renderLogManagementHTML()}
      ${this.renderBackupHTML()}
    `;

    // Bind Tab Events after rendering
    this.bindAdminTabs();
    this.initDashboardCharts(); // If using simple CSS charts
  }

  // ========================================
  // Admin UI Components
  // ========================================

  renderAdminDashboardHTML() {
    const totalLogs = this.logs.length;
    const totalUsers = Object.keys(this.users).length;
    const popularTag = (this.calculatePopularTags && this.calculatePopularTags()[0]) || '-';
    // Simple verification of recent posts (last 7 days)
    const recentPosts = this.logs.filter(l => {
      const d = new Date(l.createdAt);
      const now = new Date();
      return (now - d) < 7 * 24 * 60 * 60 * 1000;
    }).length;

    return `
      <div class="admin-panel">
        <div class="admin-panel-header"><div class="admin-panel-title">📊 ダッシュボード</div></div>
        <div class="dashboard-stats">
           <div class="stat-card"><h3>総ログ数</h3><p>${totalLogs}</p></div>
           <div class="stat-card"><h3>ユーザー数</h3><p>${totalUsers}</p></div>
           <div class="stat-card"><h3>今週の投稿</h3><p>${recentPosts}</p></div>
           <div class="stat-card"><h3>人気タグ1位</h3><p>${popularTag}</p></div>
        </div>
      </div>
    `;
  }

  renderAnnouncementsHTML() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-header"><div class="admin-panel-title">📢 お知らせ管理</div></div>
        <div class="custom-input-row mb-md">
           <input type="text" id="annText" class="form-input" placeholder="お知らせ内容" style="flex:2">
           <select id="annLevel" class="form-select" style="width:100px">
              <option value="info">情報</option>
              <option value="important">重要</option>
           </select>
           <button class="btn btn-primary" onclick="app.addAnnouncement()">投稿</button>
        </div>
        <ul class="admin-list">
           ${this.announcements.map(ann => `
             <li>
               <span class="badge ${ann.level === 'important' ? 'badge-danger' : 'badge-primary'}">${ann.level}</span>
               ${this.escapeHtml(ann.text)} (${ann.date})
               <button class="btn btn-danger btn-xs" onclick="app.deleteAnnouncement('${ann.id}')">削除</button>
             </li>
           `).join('')}
        </ul>
      </div>
    `;
  }

  renderMasterDataHTML() {
    // Helper for List Editor (Parts, Options)
    this.renderMasterDataHTML.editor = (title, key, list) => `
      <div class="master-editor-section">
         <h4 class="text-sm mb-sm">${title}</h4>
         <div class="custom-input-row mb-sm">
            <input type="text" id="newMaster_${key}" class="form-input" placeholder="新しい項目...">
            <button class="btn btn-primary btn-sm" onclick="app.addMasterItem('${key}')">追加</button>
         </div>
         <div class="data-list-scroll">
            ${list.map(item => `
               <span class="badge badge-outline">
                 ${this.escapeHtml(item)}
                 <span class="badge-remove" onclick="app.removeMasterItem('${key}', '${item.replace(/'/g, "\\'")}')">&times;</span>
               </span>
            `).join('')}
         </div>
      </div>
    `;

    return `
      <div class="admin-panel">
        <div class="admin-panel-header"><div class="admin-panel-title">🛠️ マスタデータ管理</div></div>
        
        <div class="admin-tabs">
          <button class="admin-tab-btn active" onclick="app.switchMasterTab('avatar')">アバター設定</button>
          <button class="admin-tab-btn" onclick="app.switchMasterTab('parts')">パーツ設定</button>
          <button class="admin-tab-btn" onclick="app.switchMasterTab('options')">選択肢設定</button>
          <button class="admin-tab-btn" onclick="app.switchMasterTab('system')">システム設定</button>
        </div>

        <div id="masterTab_avatar" class="master-tab-content">
          ${this.renderAvatarEditor()}
        </div>
        <div id="masterTab_parts" class="master-tab-content" style="display:none">
          ${this.renderMasterDataHTML.editor(this.labels.parts || 'パーツ', 'parts', this.parts)}
        </div>
        <div id="masterTab_options" class="master-tab-content" style="display:none">
          ${this.renderMasterDataHTML.editor(this.labels.unity || 'Unityバージョン', 'unityVersions', this.unityVersionOptions)}
          ${this.renderMasterDataHTML.editor(this.labels.sdk || 'SDKバージョン', 'vrcSdkVersions', this.vrcSdkVersionOptions)}
          ${this.renderMasterDataHTML.editor(this.labels.problem || '発生した問題', 'problemOptions', this.problemOptions)}
          ${this.renderMasterDataHTML.editor(this.labels.tool || '使用ツール', 'toolOptions', this.toolOptions)}
          ${this.renderMasterDataHTML.editor('アバタープリセット(旧)', 'avatarPresets', this.avatarPresets)}
        </div>
        <div id="masterTab_system" class="master-tab-content" style="display:none">
          ${this.renderSystemSettings()}
        </div>
      </div>
    `;
  }

  // Admin Tab Switcher & Editors
  switchMasterTab(tabName) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.master-tab-content').forEach(c => c.style.display = 'none');
    document.getElementById('masterTab_' + tabName).style.display = 'block';
  }

  renderAvatarEditor() {
    return `
      <div class="avatar-edit-form">
        <h4 class="text-sm mb-sm">新規アバター追加</h4>
        <div class="form-row">
          <div class="form-group">
            <input type="text" id="newAvatarName" class="form-input" placeholder="アバター名 (必須)">
          </div>
          <div class="form-group">
            <input type="text" id="newAvatarCreator" class="form-input" placeholder="クリエイター名">
          </div>
          <div class="form-group">
             <input type="text" id="newAvatarImage" class="form-input" placeholder="画像URL (任意)">
          </div>
          <button class="btn btn-primary" onclick="app.addAvatar()">追加</button>
        </div>
        <div id="avatarAddError" class="text-danger text-sm mt-xs"></div>
      </div>
      
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th style="width: 60px;">画像</th>
              <th>アバター名</th>
              <th>クリエイター</th>
              <th style="width: 100px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${this.avatars.map(a => `
              <tr>
                <td><img src="${a.imageUrl || 'https://via.placeholder.com/40'}" class="admin-avatar-thumb" onerror="this.src='https://via.placeholder.com/40'"></td>
                <td>${this.escapeHtml(a.name)}</td>
                <td>${this.escapeHtml(a.creator || '-')}</td>
                <td>
                   <div class="admin-actions">
                     <button class="btn btn-danger btn-icon-sm" onclick="app.removeAvatar('${a.id}')">削除</button>
                   </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderSystemSettings() {
    return `
      <div class="cfg-section">
        <h4 class="text-sm mb-md">表示ラベル設定 (カテゴリ名の変更)</h4>
        
        <div class="config-label-edit">
          <label>Unityバージョン</label>
          <input type="text" class="form-input" value="${this.escapeHtml(this.labels.unity || 'Unityバージョン')}" onchange="app.updateLabel('unity', this.value)">
        </div>
        <div class="config-label-edit">
          <label>SDKバージョン</label>
          <input type="text" class="form-input" value="${this.escapeHtml(this.labels.sdk || 'SDKバージョン')}" onchange="app.updateLabel('sdk', this.value)">
        </div>
        <div class="config-label-edit">
          <label>パーツ</label>
          <input type="text" class="form-input" value="${this.escapeHtml(this.labels.parts || 'パーツ')}" onchange="app.updateLabel('parts', this.value)">
        </div>
        <div class="config-label-edit">
           <label>発生した問題</label>
           <input type="text" class="form-input" value="${this.escapeHtml(this.labels.problem || '発生した問題')}" onchange="app.updateLabel('problem', this.value)">
        </div>
        <div class="config-label-edit">
           <label>使用ツール</label>
           <input type="text" class="form-input" value="${this.escapeHtml(this.labels.tool || '使用ツール')}" onchange="app.updateLabel('tool', this.value)">
        </div>
      </div>
    `;
  }

  renderUserManagementHTML() {
    return `
      <div class="admin-panel">
         <div class="admin-panel-header">
           <div class="admin-panel-title">👥 ユーザー管理</div>
         </div>
         
         <!-- Search Box -->
         <div class="admin-search-box mb-md">
           <input type="text" class="form-input" id="userSearchInput" placeholder="ユーザーID、ニックネーム、メールで検索..." oninput="app.filterUsers()">
         </div>
         
         <div class="admin-table-wrapper">
           <table class="admin-table">
             <thead>
               <tr>
                 <th>ニックネーム</th>
                 <th>メール</th>
                 <th>ユーザーID</th>
                 <th>登録日</th>
                 <th>操作</th>
               </tr>
             </thead>
             <tbody id="userTableBody">
               ${this.renderUserRows(Object.entries(this.users))}
             </tbody>
           </table>
         </div>
         <div class="text-muted text-sm mt-sm">合計: ${Object.keys(this.users).length} 人</div>
      </div>
    `;
  }

  renderUserRows(users) {
    if (users.length === 0) {
      return '<tr><td colspan="5" class="text-center text-muted">ユーザーが見つかりません</td></tr>';
    }
    return users.map(([uid, data]) => {
      const displayName = data?.displayName || '名前未設定';
      const email = data?.email || '不明';
      const createdAt = data?.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : '不明';
      return `
        <tr>
          <td><strong>${this.escapeHtml(displayName)}</strong></td>
          <td class="text-sm">${this.escapeHtml(email)}</td>
          <td class="text-xs text-muted" title="${uid}">${uid.substring(0, 12)}...</td>
          <td class="text-sm">${createdAt}</td>
          <td>
            <div class="admin-actions">
              <button class="btn btn-warning btn-sm" onclick="app.adminResetPassword('${uid}')">PW変更</button>
              <button class="btn btn-danger btn-sm" onclick="app.adminDeleteUser('${uid}')">削除</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  filterUsers() {
    const query = document.getElementById('userSearchInput')?.value?.toLowerCase() || '';
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    const filtered = Object.entries(this.users).filter(([uid, data]) => {
      const displayName = (data?.displayName || '').toLowerCase();
      const email = (data?.email || '').toLowerCase();
      return uid.toLowerCase().includes(query) || displayName.includes(query) || email.includes(query);
    });

    tbody.innerHTML = this.renderUserRows(filtered);
  }

  renderLogManagementHTML() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-header"><div class="admin-panel-title">📚 ログ管理</div></div>
        <div class="admin-table-wrapper">
          <table class="admin-table">
            <thead><tr><th>日時</th><th>タイトル</th><th>操作</th></tr></thead>
            <tbody>
              ${this.logs.map(log => `
                <tr>
                  <td>${log.createdAt}</td>
                  <td>${this.escapeHtml(log.title)}</td>
                  <td><button class="btn btn-danger btn-sm" onclick="app.deleteLog('${log.id}')">削除</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderBackupHTML() {
    return `
      <div class="admin-panel">
        <div class="admin-panel-header"><div class="admin-panel-title">💾 バックアップ</div></div>
         <textarea class="io-area" id="dataIoArea">${this.exportAllData()}</textarea>
         <div class="text-right">
             <button class="btn btn-secondary" onclick="app.copyToClipboard()">コピー</button>
             <button class="btn btn-warning" onclick="app.importData()">復元</button>
         </div>
      </div>
    `;
  }

  // ========================================
  // Admin UI Interaction Methods
  // ========================================

  bindAdminTabs() {
    // Simple tab switching logic handled by switchAdminTab
  }

  switchAdminTab(key) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    // Find button by onclick attribute text (naive but works for generated HTML)
    const btn = Array.from(document.querySelectorAll('.admin-tab')).find(b => b.onclick.toString().includes(key));
    if (btn) btn.classList.add('active');

    document.getElementById(`tab_${key}`).classList.add('active');
  }

  async addAnnouncement() {
    const text = document.getElementById('annText').value.trim();
    const level = document.getElementById('annLevel').value;
    if (!text) return;

    try {
      await this.db.collection('announcements').add({
        text, level, date: new Date().toISOString().split('T')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.showToast('お知らせを追加しました');
      document.getElementById('annText').value = '';
    } catch (e) { console.error(e); this.showToast('追加エラー', 'error'); }
  }

  async deleteAnnouncement(id) {
    if (!confirm('削除しますか？')) return;
    try {
      await this.db.collection('announcements').doc(id).delete();
      this.showToast('削除しました');
    } catch (e) { console.error(e); this.showToast('削除エラー', 'error'); }
  }

  // Admin Data Management
  async deleteLog(id) {
    if (!confirm('本当に削除しますか？')) return;
    try {
      await this.db.collection('logs').doc(id).delete();
      this.showToast('ログを削除しました');
    } catch (e) {
      console.error(e);
      const msg = e.code === 'permission-denied' ? '権限がありません (Permission Denied)' : e.message;
      this.showToast('削除エラー: ' + msg, 'error');
    }
  }

  adminResetPassword(u) {
    alert('Firebase版ではコンソールからメールを送信するか、ユーザー自身にリセットさせてください。');
  }

  adminDeleteUser(u) {
    alert('Firebase版ではコンソールから削除してください。');
  }

  // Master Data Helper
  // Master Data Helper
  async addMasterItem(key) {
    const input = document.getElementById('newMaster_' + key);
    const val = input ? input.value.trim() : null;
    if (!val) return;

    try {
      const updates = {};
      updates[key] = firebase.firestore.FieldValue.arrayUnion(val);
      await this.db.collection('masterData').doc('config').set(updates, { merge: true });
      this.showToast('追加しました', 'success');
      input.value = '';
    } catch (e) { console.error(e); this.showToast('更新エラー', 'error'); }
  }

  async removeMasterItem(key, val) {
    if (!confirm(`"${val}" を削除しますか？`)) return;
    try {
      const doc = await this.db.collection('masterData').doc('config').get();
      if (!doc.exists) return;

      const currentList = doc.data()[key] || [];
      const newList = currentList.filter(item => item !== val);

      const updates = {};
      updates[key] = newList;

      await this.db.collection('masterData').doc('config').update(updates);
      this.showToast('削除しました', 'success');
    } catch (e) {
      console.error(e);
      const msg = e.code === 'permission-denied' ? '権限がありません' : e.message;
      this.showToast('更新エラー: ' + msg, 'error');
    }
  }

  async addAvatar() {
    const name = document.getElementById('newAvatarName').value.trim();
    const creator = document.getElementById('newAvatarCreator').value.trim();
    const image = document.getElementById('newAvatarImage').value.trim();

    if (!name) {
      document.getElementById('avatarAddError').textContent = 'アバター名は必須です';
      return;
    }

    const newAvatar = {
      id: 'av_' + Date.now(),
      name: name,
      creator: creator,
      imageUrl: image
    };

    try {
      await this.db.collection('masterData').doc('config').update({
        avatars: firebase.firestore.FieldValue.arrayUnion(newAvatar)
      });
      this.showToast('アバターを追加しました', 'success');
      // Clear inputs
      document.getElementById('newAvatarName').value = '';
      document.getElementById('newAvatarCreator').value = '';
      document.getElementById('newAvatarImage').value = '';
      document.getElementById('avatarAddError').textContent = '';
    } catch (e) { console.error(e); this.showToast('エラーが発生しました', 'error'); }
  }

  async removeAvatar(id) {
    if (!confirm('このアバター設定を削除しますか？')) return;

    try {
      const doc = await this.db.collection('masterData').doc('config').get();
      if (!doc.exists) return;
      const data = doc.data();
      const avatars = data.avatars || [];

      const newAvatars = avatars.filter(a => a.id !== id);

      await this.db.collection('masterData').doc('config').update({ avatars: newAvatars });
      this.showToast('削除しました', 'success');
    } catch (e) {
      console.error(e);
      const msg = e.code === 'permission-denied' ? '権限がありません' : e.message;
      this.showToast('削除エラー: ' + msg, 'error');
    }
  }

  async updateLabel(key, value) {
    try {
      const labels = { ...this.labels, [key]: value };
      await this.db.collection('masterData').doc('config').set({ labels }, { merge: true });
      this.showToast('ラベルを更新しました', 'success');
    } catch (e) { console.error(e); this.showToast('ラベル更新エラー', 'error'); }
  }



  initDashboardCharts() {
    // Placeholder for charts
  }




  // Note: Admin user management functions are now handled via Firebase Console
  // (see adminResetPassword and adminDeleteUser above)

  adminAddUser() {
    const u = document.getElementById('adminNewUser').value.trim();
    const p = document.getElementById('adminNewPass').value.trim();
    if (!u || !p) return alert('ユーザー名とパスワードを入力してください');
    if (this.users[u]) return alert('そのユーザー名は既に存在します');

    this.users[u] = { password: btoa(p), createdAt: new Date().toISOString() };
    localStorage.setItem('vrc_users', JSON.stringify(this.users));
    this.showToast('ユーザーを追加しました', 'success');
    this.renderAdminPage();
  }

  // Emergency Feature
  emergencyAdminReset() {
    if (confirm('【緊急用】管理者パスワードを初期値(admin123)にリセットしますか？')) {
      if (!this.users['admin']) this.users['admin'] = { createdAt: new Date().toISOString() };
      this.users['admin'].password = btoa('admin123');
      localStorage.setItem('vrc_users', JSON.stringify(this.users));
      alert('リセットしました。admin / admin123 でログインしてください。');
      location.reload();
    }
  }

  // Admin Actions


  addAdminOption(type, inputId) {
    const input = document.getElementById(inputId);
    const val = input.value.trim();
    if (val && !this[type].includes(val)) {
      this[type].push(val);
      this.saveData(type, this[type]);
      this.renderAdminPage(); // Re-render to update list
      this.showToast('項目を追加しました', 'success');
    }
  }

  removeAdminOption(type, val) {
    if (confirm(`「${val}」を削除しますか？`)) {
      this[type] = this[type].filter(v => v !== val);
      this.saveData(type, this[type]);
      this.renderAdminPage();
      this.showToast('項目を削除しました');
    }
  }

  createDataList(array, type) {
    return array.map(item => `
        <div class="data-list-item">
            <span>${this.escapeHtml(item)}</span>
            <button class="btn-text-delete" onclick="app.removeAdminOption('${type}', '${item.replace(/'/g, "\\'")}')">削除</button>
        </div>
      `).join('');
  }

  exportAllData() {
    const data = {
      logs: this.logs,
      toolOptions: this.toolOptions,
      problemOptions: this.problemOptions,
      users: this.users,
      bookmarks: this.bookmarks
      // Avatars and Parts are static for MVP but could be added if customized
    };
    return JSON.stringify(data, null, 2);
  }

  importData() {
    const json = document.getElementById('dataIoArea').value;
    try {
      const data = JSON.parse(json);
      // Validate minimally
      if (!data.logs || !Array.isArray(data.logs)) throw new Error('Invalid Format');

      if (confirm('現在のデータをすべて上書きして復元しますか？')) {
        if (data.logs) this.saveData('logs', data.logs);
        if (data.toolOptions) this.saveData('toolOptions', data.toolOptions);
        if (data.problemOptions) this.saveData('problemOptions', data.problemOptions);
        if (data.users) localStorage.setItem('vrc_users', JSON.stringify(data.users));
        if (data.bookmarks) localStorage.setItem('vrc_bookmarks', JSON.stringify(data.bookmarks));

        // Reload
        location.reload();
      }
    } catch (e) {
      this.showToast('データの読み込みに失敗しました: ' + e.message, 'error');
    }
  }

  copyToClipboard() {
    const area = document.getElementById('dataIoArea');
    area.select();
    document.execCommand('copy');
    this.showToast('クリップボードにコピーしました！', 'success');
  }

  // ========================================
  // Helper Logic
  // ========================================

  bindFormEvents() {
    this.setupCallbackToggle('logUnity', 'logUnityCustom');
    this.setupCallbackToggle('logSdk', 'logSdkCustom');
    this.setupCallbackToggle('logAvatar', 'logAvatarCustom');

    // Star rating
    const starInput = document.getElementById('starInput');
    if (starInput) {
      const stars = starInput.querySelectorAll('.star');
      stars.forEach(star => {
        star.addEventListener('click', () => {
          const value = parseInt(star.dataset.value);
          document.getElementById('logSuccess').value = value;
          stars.forEach((s, i) => {
            s.textContent = i < value ? '★' : '☆';
            s.classList.toggle('filled', i < value);
          });
        });
      });
      // Set default 3
      stars.forEach((s, i) => {
        s.textContent = i < 3 ? '★' : '☆';
        s.classList.toggle('filled', i < 3);
      });
    }

    // Checkboxes
    document.querySelectorAll('.form-checkbox-item input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        checkbox.parentElement.classList.toggle('checked', checkbox.checked);
      });
    });

    // Tag input
    const tagInput = document.getElementById('logTagInput');
    if (tagInput) {
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (e.isComposing) return; // Ignore IME composition
          e.preventDefault();
          let tag = tagInput.value.trim();
          if (tag && !tag.startsWith('#')) tag = '#' + tag;
          if (tag && !this.selectedTags.includes(tag)) {
            this.selectedTags.push(tag);
            this.renderSelectedTags();
          }
          tagInput.value = '';
        }
      });
    }

    // Enter key support for other inputs
    const enterInputs = [
      { id: 'customPartsInput', action: () => this.addCustomPart() },
      { id: 'customProblemInput', action: () => this.addCustomProblem() },
      { id: 'customToolInput', action: () => this.addCustomTool() },
      { id: 'referenceLinkInput', action: () => this.addReferenceLink() },
      { id: 'imageUrlInput', action: () => this.addImageUrl() }
    ];

    enterInputs.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            if (e.isComposing) return; // Ignore IME
            e.preventDefault();
            item.action();
          }
        });
      }
    });

    // Image handling
    const imageInput = document.getElementById('imageInput');
    const uploadArea = document.getElementById('imageUploadArea');
    if (imageInput) imageInput.addEventListener('change', (e) => this.handleImageUpload(e.target.files));
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
      uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
      uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragover'); this.handleImageUpload(e.dataTransfer.files); });
    }

    // Submit
    const form = document.getElementById('logForm');
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.submitLog(); });
  }

  addImageUrl() {
    const input = document.getElementById('imageUrlInput');
    const url = input?.value.trim();
    if (url) {
      this.uploadedImages.push({
        id: 'img_' + Date.now() + Math.random().toString(36).substr(2, 5),
        dataUrl: url,
        isNsfw: false
      });
      this.renderImagePreviews();
      input.value = '';
    }
  }

  // ... (Other helpers: setupCallbackToggle, addTag, etc)
  setupCallbackToggle(sId, cId) {
    const s = document.getElementById(sId), c = document.getElementById(cId);
    if (s && c) s.addEventListener('change', () => c.style.display = s.value === 'その他' ? 'block' : 'none');
  }

  // Custom Item Helpers
  addTag(tag) { if (!this.selectedTags.includes(tag)) { this.selectedTags.push(tag); this.renderSelectedTags(); } }
  removeTag(tag) { this.selectedTags = this.selectedTags.filter(t => t !== tag); this.renderSelectedTags(); }
  renderSelectedTags() { this.renderList('selectedTags', this.selectedTags, 'tag', 'removeTag'); }

  addCustomPart() { this.addCustomItem('customPartsInput', 'customParts', 'renderCustomParts'); }
  removeCustomPart(v) { this.removeCustomItem(v, 'customParts', 'renderCustomParts'); }
  renderCustomParts() { this.renderList('customPartsList', this.customParts, 'custom-item', 'removeCustomPart', true); }

  addCustomProblem() { this.addCustomItem('customProblemInput', 'customProblems', 'renderCustomProblems'); }
  removeCustomProblem(v) { this.removeCustomItem(v, 'customProblems', 'renderCustomProblems'); }
  renderCustomProblems() { this.renderList('customProblemsList', this.customProblems, 'custom-item', 'removeCustomProblem', true); }

  addCustomTool() { this.addCustomItem('customToolInput', 'customTools', 'renderCustomTools'); }
  removeCustomTool(v) { this.removeCustomItem(v, 'customTools', 'renderCustomTools'); }
  renderCustomTools() { this.renderList('customToolsList', this.customTools, 'custom-item', 'removeCustomTool', true); }

  addReferenceLink() {
    const i = document.getElementById('referenceLinkInput');
    if (i && i.value.trim()) { this.referenceLinks.push(i.value.trim()); i.value = ''; this.renderReferenceLinks(); }
  }
  removeReferenceLink(idx) { this.referenceLinks.splice(idx, 1); this.renderReferenceLinks(); }
  renderReferenceLinks() {
    const c = document.getElementById('referenceLinksList');
    if (c) c.innerHTML = this.referenceLinks.map((l, i) => `<li><span class="ref-link-display">${this.escapeHtml(l)}</span><button class="btn-text-delete" onclick="app.removeReferenceLink(${i})">削除</button></li>`).join('');
  }

  addCustomItem(inputId, arrName, renderName) {
    const input = document.getElementById(inputId);
    const val = input?.value.trim();
    if (val && !this[arrName].includes(val)) { this[arrName].push(val); this[renderName](); input.value = ''; }
  }
  removeCustomItem(val, arrName, renderName) {
    this[arrName] = this[arrName].filter(v => v !== val); this[renderName]();
  }
  renderList(cId, arr, cls, method, esc) {
    const c = document.getElementById(cId);
    if (c) c.innerHTML = arr.map(item => `<span class="${cls === 'tag' ? 'selected-tag' : 'custom-item'}">${esc ? this.escapeHtml(item) : item} <button type="button" onclick="app.${method}('${item.replace(/'/g, "\\'")}')">&times;</button></span>`).join('');
  }

  handleImageUpload(files) {
    const max = 5 - this.uploadedImages.length;
    Array.from(files).slice(0, max).forEach(f => {
      if (f.type.startsWith('image/')) {
        this.compressImage(f).then(dataUrl => {
          this.uploadedImages.push({
            id: 'img_' + Date.now() + Math.random().toString(36).substr(2, 5),
            dataUrl: dataUrl,
            isNsfw: false
          });
          this.renderImagePreviews();
        });
      }
    });
  }

  // Image Compression - preserves text readability
  compressImage(file, maxWidth = 1600, quality = 0.85) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }

          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          // Draw with high quality
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Output as JPEG with specified quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          // Log compression result
          const originalSize = (e.target.result.length / 1024).toFixed(1);
          const compressedSize = (compressedDataUrl.length / 1024).toFixed(1);
          console.log(`Image compressed: ${originalSize}KB → ${compressedSize}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);

          resolve(compressedDataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
  renderImagePreviews() {
    const c = document.getElementById('imagePreviewGrid');
    if (!c) return;

    // Default first image as thumbnail if none selected
    if (this.uploadedImages.length > 0 && !this.uploadedImages.some(img => img.isThumbnail)) {
      this.uploadedImages[0].isThumbnail = true;
    }

    c.innerHTML = this.uploadedImages.map((img, i) => `
      <div class="image-preview-item ${img.isThumbnail ? 'is-thumbnail' : ''}">
        <img src="${img.dataUrl}">
        ${img.isThumbnail ? '<div class="thumbnail-badge"><span class="material-icons-round">star</span>サムネ</div>' : ''}
        <div class="image-preview-actions">
          <button class="btn-thumbnail ${img.isThumbnail ? 'active' : ''}" type="button" onclick="app.setThumbnail(${i})" title="サムネイルに設定">
            <span class="material-icons-round">photo_camera</span>
          </button>
          <label class="nsfw-toggle"><input type="checkbox" ${img.isNsfw ? 'checked' : ''} onchange="app.toggleNsfw(${i})">🔞</label>
          <button class="btn-remove" type="button" onclick="app.removeImage(${i})">×</button>
        </div>
      </div>
    `).join('');
  }

  setThumbnail(index) {
    this.uploadedImages.forEach((img, i) => {
      img.isThumbnail = (i === index);
    });
    this.renderImagePreviews();
    this.showToast('サムネイルを設定しました', 'success');
  }

  toggleNsfw(i) { if (this.uploadedImages[i]) this.uploadedImages[i].isNsfw = !this.uploadedImages[i].isNsfw; }
  removeImage(i) { this.uploadedImages.splice(i, 1); this.renderImagePreviews(); }

  async submitLog() {
    // Guest Access Allowed
    // if (!this.currentUser) { this.showToast('ログインしてください', 'error'); this.login(); return; }

    const isGuest = !this.currentUser;
    const currentUid = this.currentUser || 'guest';

    const title = document.getElementById('logTitle').value;
    let avatarId = document.getElementById('logAvatar').value;
    let customAvatarName = null;
    if (avatarId === 'その他') { avatarId = null; customAvatarName = document.getElementById('logAvatarCustom').value; if (!customAvatarName) { this.showToast('アバター名を入力', 'error'); return; } }
    else if (!avatarId) { this.showToast('アバターを選択', 'error'); return; }

    let unity = document.getElementById('logUnity').value; if (unity === 'その他') unity = document.getElementById('logUnityCustom').value || 'Unknown';
    let sdk = document.getElementById('logSdk').value; if (sdk === 'その他') sdk = document.getElementById('logSdkCustom').value || 'Unknown';

    const diff = document.getElementById('logDifficulty').value;
    const success = parseInt(document.getElementById('logSuccess').value);
    const solution = document.getElementById('logSolution').value;

    const parts = Array.from(document.querySelectorAll('#partsCheckboxes input:checked')).map(c => c.value);
    const probs = Array.from(document.querySelectorAll('#problemCheckboxes input:checked')).map(c => c.value);
    if (this.customProblems.length) probs.push(...this.customProblems);
    if (!probs.length) probs.push('特になし');

    const tools = Array.from(document.querySelectorAll('input[name="tools"]:checked')).map(c => c.value);
    if (this.customTools.length) tools.push(...this.customTools);

    // Note: Not storing Base64 in Firestore (1MB limit). Images are local-only for now.
    // TODO: Use Firebase Storage for proper image hosting
    const imgs = this.uploadedImages.map(i => ({ id: i.id, isNsfw: i.isNsfw || false }));

    if (!title || !solution) { this.showToast('必須項目を入力してください', 'error'); return; }

    const newLog = {
      title, avatarId, customAvatarName, partsIds: parts, customPartsNames: this.customParts,
      unityVersion: unity, vrcSdkVersion: sdk, difficulty: diff, successRate: success, problems: probs, solution,
      tags: this.selectedTags, tools, referenceLinks: this.referenceLinks, images: imgs,
      createdAt: new Date().toISOString(), userId: currentUid, isGuest, guestName: isGuest ? 'ゲスト' : null,
      // Firestore Metadata
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      this.showToast('送信中...', 'info');
      const docRef = await this.db.collection('logs').add(newLog);

      // Clear form
      this.customParts = []; this.customProblems = []; this.customTools = []; this.selectedTags = []; this.uploadedImages = []; this.referenceLinks = [];

      this.showToast('✨ 投稿が完了しました！', 'success');
      this.navigateTo('detail', docRef.id);
    } catch (e) {
      console.error(e);
      this.showToast('投稿に失敗しました: ' + e.message, 'error');
    }
  }

  // ========================================
  // Detail Page Render
  // ========================================
  renderDetailPage(id) {
    const log = this.logs.find(l => l.id === id);
    if (!log) { this.navigateTo('list'); return; }

    // Increment view count
    this.incrementViews(id);

    const av = this.avatars.find(a => a.id === log.avatarId);
    const avName = log.customAvatarName || (av ? av.name : '不明');
    const avCreator = log.customAvatarName ? 'カスタム' : (av ? av.creator : '不明');
    const parts = log.partsIds.map(pid => this.parts.find(p => p.id === pid)).filter(Boolean);

    const c = document.getElementById('logDetail');
    if (!c) return;

    const isBM = this.bookmarks.includes(id);
    const isLiked = (log.likedBy || []).includes(this.currentUser?.uid);
    const likeCount = log.likes || 0;
    const viewCount = log.views || 0;

    c.innerHTML = `
        <div class="detail-header">
            <div class="detail-stats">
               <span class="stat-item"><span class="material-icons-round">visibility</span> ${viewCount}</span>
               <span class="stat-item heart ${isLiked ? 'liked' : ''}" onclick="app.toggleLike('${log.id}')">
                  <span class="material-icons-round">${isLiked ? 'favorite' : 'favorite_border'}</span> ${likeCount}
               </span>
            </div>
            <div class="detail-actions">
                <button class="btn-icon ${isBM ? 'active' : ''}" onclick="app.toggleBookmark('${log.id}')" title="ブックマーク">
                   <span class="material-icons-round">bookmark${isBM ? '' : '_border'}</span>
                </button>
                <button class="btn-icon" onclick="app.shareToTwitter('${log.title}','${log.id}')" title="Xでシェア">
                   <span class="material-icons-round">share</span>
                </button>
            </div>
            <h1 class="detail-title">${this.escapeHtml(log.title)}</h1>
            <div class="detail-meta">${this.getDifficultyBadge(log.difficulty)} <div class="stars">${this.renderStars(log.successRate)}</div> <span class="text-muted">${log.createdAt}</span></div>
            ${log.tags?.length ? `<div class="detail-tags mt-sm">${log.tags.map(t => `<span class="tag-chip" onclick="app.searchByTag('${t}')">${t}</span>`).join('')}</div>` : ''}
            ${log.tools?.length ? `<div class="mt-md"><h4 class="text-muted text-sm mb-sm">使用ツール</h4><div class="tool-badges">${log.tools.map(t => `<span class="badge badge-tool">${t}</span>`).join('')}</div></div>` : ''}
        </div>
        
        <div class="detail-section"><h3 class="detail-section-title">📦 使用アバター</h3>
            <div class="info-grid"><div class="info-item"><div class="info-label">アバター</div><div class="info-value">${this.escapeHtml(avName)}</div></div><div class="info-item"><div class="info-label">作者</div><div class="info-value">${this.escapeHtml(avCreator)}</div></div></div>
        </div>

        <div class="detail-section"><h3 class="detail-section-title">👗 使用パーツ</h3>
            <ul class="detail-list">
                ${parts.map(p => `<li><span class="badge badge-part">${this.escapeHtml(p.type)}</span> ${this.escapeHtml(p.name)}</li>`).join('')}
                ${(log.customPartsNames || []).map(p => `<li><span class="badge badge-part">その他</span> ${this.escapeHtml(p)}</li>`).join('')}
            </ul>
        </div>

        <div class="detail-section"><h3 class="detail-section-title">⚙️ 環境</h3>
            <div class="info-grid"><div class="info-item"><div class="info-label">Unity</div><div class="info-value">${this.escapeHtml(log.unityVersion)}</div></div><div class="info-item"><div class="info-label">SDK</div><div class="info-value">${this.escapeHtml(log.vrcSdkVersion)}</div></div></div>
        </div>

        <div class="detail-section"><h3 class="detail-section-title">⚠️ 問題</h3>
            ${log.problems.map(p => `<div class="problem-item">${this.escapeHtml(p)}</div>`).join('')}
        </div>

        <div class="detail-section"><h3 class="detail-section-title">💡 解決方法</h3>
            <div class="solution-box">${this.escapeHtml(log.solution)}
            ${log.referenceLinks?.length ? `<div class="mt-md"><h4 class="text-muted text-sm mb-sm">参考リンク</h4><ul class="link-list">${log.referenceLinks.map(l => `<li><a href="${l}" target="_blank" class="ref-link">🔗 ${l}</a></li>`).join('')}</ul></div>` : ''}
            </div>
        </div>

        ${log.images?.length ? `<div class="detail-section"><h3 class="detail-section-title">📸 スクリーンショット</h3><div class="image-gallery">${log.images.map((img, i) => `<div class="gallery-item ${img.isNsfw ? 'nsfw-blur' : ''}" onclick="${img.isNsfw ? `app.confirmNsfw(${i},'${id}')` : `app.showLightbox('${img.dataUrl}')`}"><img src="${img.dataUrl}">${img.isNsfw ? '<div class="nsfw-overlay">🔞 表示</div>' : ''}</div>`).join('')}</div></div>` : ''}
        
        <div class="comments-section">
          <h3>💬 コメント (${log.comments ? log.comments.length : 0})</h3>
          <ul class="comment-list">
             ${(log.comments && log.comments.length > 0) ? log.comments.map((c, i) => `
                <li class="comment-item">
                   <div class="comment-header">
                      <span class="comment-user">👤 ${this.escapeHtml(c.userId)}</span>
                      <span class="comment-date">${c.createdAt}</span>
                   </div>
                   <div class="comment-body">${this.escapeHtml(c.text)}</div>
                   ${this.isAdmin() ? `<button class="btn btn-danger btn-xs mt-sm" onclick="app.deleteComment('${log.id}', ${i})">削除</button>` : ''}
                </li>
             `).join('') : '<li class="text-muted">コメントはまだありません</li>'}
          </ul>
          
          ${this.isLoggedIn ? `
             <div class="comment-form mt-md">
                <textarea id="commentText" class="form-textarea" placeholder="コメントを入力..." rows="3"></textarea>
                <div class="text-right mt-sm">
                   <button class="btn btn-primary" onclick="app.addComment('${log.id}')">送信</button>
                </div>
             </div>
          ` : '<p class="text-muted mt-md">コメントするには<a href="#" onclick="app.login()">ログイン</a>してください</p>'}
        </div>

        <div class="text-center mt-lg"><button class="btn btn-secondary" onclick="app.navigateTo('list')">一覧に戻る</button></div>
      `;
  }

  // Common UI
  renderLogCards(contId, list) {
    const c = document.getElementById(contId);
    if (!c) return;
    c.innerHTML = list.map(l => {
      const av = this.avatars.find(a => a.id === l.avatarId);
      const avName = l.customAvatarName || (av ? av.name : '不明');
      return `<div class="card card-clickable" onclick="app.navigateTo('detail','${l.id}')">
            <div class="card-image">🎀</div>
            <div class="card-body">
                <h3 class="card-title">${this.escapeHtml(l.title)}</h3>
                <div class="card-meta"><span class="card-avatar">👤 ${this.escapeHtml(avName)}</span></div>
                <div class="card-footer"><div class="stars">${this.renderStars(l.successRate)}</div>${this.getDifficultyBadge(l.difficulty)}</div>
            </div>
        </div>`;
    }).join('');
  }

  checkLoginForPage(containerId, title, isOptional = false) {
    if (!this.isLoggedIn) {
      if (isOptional) return true; // Allow access if optional

      const c = document.getElementById(containerId);
      if (c) c.innerHTML = `<div class="login-notice"><div class="login-notice-icon">🔐</div><h3 class="login-notice-title">ログインが必要です</h3><p class="login-notice-text">${title}にはログインしてください</p><button class="btn btn-primary" onclick="app.login()">🔑 ログイン</button></div>`;
      return false;
    }
    return true;
  }

  calculatePopularTags() {
    const counts = {};
    this.logs.forEach(l => (l.tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  }

  searchFromHome() {
    const k = document.querySelector('.search-input').value;
    const a = document.getElementById('searchAvatar').value;
    const p = document.getElementById('searchParts').value;
    const b = document.getElementById('searchBeginner').checked;
    this.navigateTo('list');
    this.renderListPage({ keyword: k, avatarId: a, partsId: p, beginnerOnly: b });
  }

  // Utils
  escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
  renderStars(r) { return [1, 2, 3, 4, 5].map(i => `<span class="star ${i <= r ? 'filled' : ''}">★</span>`).join(''); }
  getDifficultyBadge(d) { const b = { beginner: '<span class="badge badge-beginner">🌱 初心者</span>', intermediate: '<span class="badge badge-intermediate">🌿 中級者</span>', advanced: '<span class="badge badge-advanced">🌳 上級者</span>' }; return b[d] || ''; }

  showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg;
    c.appendChild(t); t.offsetHeight; t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  async toggleBookmark(id) {
    if (!this.currentUser) { this.showToast('ブックマークするにはログインが必要です', 'warning'); return; }

    const isAdded = !this.bookmarks.includes(id);
    if (!isAdded) {
      this.bookmarks = this.bookmarks.filter(i => i !== id);
      this.showToast('削除しました');
    } else {
      this.bookmarks.push(id);
      this.showToast('お気に入りに追加！', 'success');
    }

    // UI Update immediate
    this.renderDetailPage(id);

    try {
      await this.db.collection('users').doc(this.currentUser).set({ bookmarks: this.bookmarks }, { merge: true });
    } catch (e) { console.error('Bookmark sync fail', e); }
  }

  async toggleLike(id) {
    if (!this.currentUser) { this.showToast('いいねするにはログインが必要です', 'warning'); return; }

    const logRef = this.db.collection('logs').doc(id);
    const log = this.logs.find(l => l.id === id);
    if (!log) return;

    const likedBy = log.likedBy || [];
    const isLiked = likedBy.includes(this.currentUser.uid);

    try {
      if (isLiked) {
        // Unlike
        await logRef.update({
          likes: firebase.firestore.FieldValue.increment(-1),
          likedBy: firebase.firestore.FieldValue.arrayRemove(this.currentUser.uid)
        });
        log.likes = (log.likes || 1) - 1;
        log.likedBy = likedBy.filter(uid => uid !== this.currentUser.uid);
        this.showToast('いいねを取り消しました');
      } else {
        // Like
        await logRef.update({
          likes: firebase.firestore.FieldValue.increment(1),
          likedBy: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid)
        });
        log.likes = (log.likes || 0) + 1;
        log.likedBy = [...likedBy, this.currentUser.uid];
        this.showToast('いいね！しました ❤️', 'success');
      }
      this.renderDetailPage(id);
    } catch (e) {
      console.error('Like toggle fail', e);
      this.showToast('エラーが発生しました', 'error');
    }
  }

  async incrementViews(id) {
    // Only increment once per session per log
    if (!this.viewedLogs) this.viewedLogs = new Set();
    if (this.viewedLogs.has(id)) return;
    this.viewedLogs.add(id);

    const log = this.logs.find(l => l.id === id);
    if (log) log.views = (log.views || 0) + 1;

    try {
      await this.db.collection('logs').doc(id).update({
        views: firebase.firestore.FieldValue.increment(1)
      });
    } catch (e) { console.error('View count fail', e); }
  }

  shareToTwitter(t, id) {
    const url = window.location.origin + window.location.pathname;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${t} #VRC改変ログ`)}&url=${encodeURIComponent(url)}`, '_blank');
  }

  confirmNsfw(i, id) {
    if (confirm('表示しますか？')) {
      const item = document.querySelectorAll('.gallery-item')[i];
      item.classList.remove('nsfw-blur'); item.querySelector('.nsfw-overlay').remove();
      const img = this.logs.find(l => l.id === id).images[i];
      item.onclick = () => this.showLightbox(img.dataUrl);
    }
  }

  showLightbox(url) {
    const l = document.getElementById('lightbox'), i = document.getElementById('lightboxImage');
    if (l && i) { i.src = url; l.classList.add('active'); }
  }

  bindEvents() {
    document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => this.navigateTo(l.dataset.page)));
    document.querySelector('.logo')?.addEventListener('click', () => this.navigateTo('home'));
    document.getElementById('homeSearchBtn')?.addEventListener('click', () => this.searchFromHome());
    document.querySelectorAll('.filter-chip').forEach(c => {
      c.addEventListener('click', () => {
        if (c.id === 'filterBookmark') c.classList.toggle('active'); // logic in render
        else c.classList.toggle('active');
        this.applyFilters();
      });
    });
    document.getElementById('lightbox')?.addEventListener('click', e => { if (e.target.id === 'lightbox' || e.target.classList.contains('lightbox-close')) document.getElementById('lightbox').classList.remove('active') });
  }

  applyFilters() {
    const k = document.querySelector('.search-input')?.value; // Keep keyword if exists in list page
    const b = document.querySelector('.filter-chip[data-filter="beginner"]')?.classList.contains('active');
    const n = document.querySelector('.filter-chip[data-filter="noProblems"]')?.classList.contains('active');
    const bm = document.getElementById('filterBookmark')?.classList.contains('active');
    this.renderListPage({ keyword: this.lastKeyword || k, beginnerOnly: b, noProblems: n, bookmarked: bm, tag: this.searchTag });
  } // Note: search input in home is for searchFromHome. In list, we might want a search bar too? For now, we reuse the flow.
  // ========================================
  // Account Recovery (Phase 4)
  // ========================================

  forgotPassword() {
    this.closeModal();
    const email = prompt('登録したメールアドレスを入力してください:\n（デモ用なので任意のメアドで通ります）');
    if (!email) return;

    // Simulate server request
    this.showToast('認証コードを送信しています...', 'info');

    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000); // 6 digit code
      // Simulate email reception via alert (in real app, this goes to email)
      alert(`【VRC改変ログ】\nパスワードリセット認証コード: ${code}\n\nこのコードをコピーしてください。`);

      const inputCode = prompt('メールに届いた6桁の認証コードを入力してください:');
      if (inputCode == code) {
        const resetUser = prompt('パスワードをリセットするユーザー名を入力してください:');
        if (!resetUser || !this.users[resetUser]) return alert('ユーザーが見つかりません');

        const newPass = prompt('新しいパスワードを入力してください:');
        if (newPass) {
          this.users[resetUser].password = btoa(newPass);
          localStorage.setItem('vrc_users', JSON.stringify(this.users));
          this.showToast('パスワードを再設定しました！ログインしてください。', 'success');
          this.login();
        }
      } else {
        this.showToast('認証コードが間違っています', 'error');
      }
    }, 1500);
  }

  // ========================================
  // My Page & Social (Phase 4)
  // ========================================

  renderMyPage() {
    if (!this.checkLoginForPage('myPageContent', 'マイページ')) return;

    const user = this.users[this.currentUser] || {};
    const myLogs = this.logs.filter(l => l.userId === this.currentUser);

    // Sort logs by date desc
    myLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const container = document.getElementById('myPageContent');
    container.innerHTML = `
       <div class="mypage-header">
          <div class="profile-card card">
             <div class="profile-edit-btn">
                <button class="btn btn-secondary btn-sm" onclick="app.toggleProfileEdit()">✏️ 編集</button>
             </div>
             <div class="profile-info">
                <div class="profile-icon">
                   ${user.icon ? (user.icon.startsWith('http') ? `<img src="${user.icon}" alt="icon">` : `<span class="default-icon">${user.icon}</span>`) : '<span class="default-icon">👤</span>'}
                </div>
                <div class="profile-details">
                   <h2 class="profile-name">${this.escapeHtml(user.displayName || this.currentUser)}</h2>
                   <p class="profile-bio">${this.escapeHtml(user.bio || '自己紹介はまだありません')}</p>
                   <div class="profile-links">
                      ${user.socialLinks ? user.socialLinks.map(l => `<a href="${l.url}" target="_blank" class="social-link">${this.escapeHtml(l.Platform || 'Link')}</a>`).join('') : ''}
                   </div>
                </div>
             </div>
             
             <!-- Edit Form (Hidden by default) -->
             <div id="profileEditForm" class="profile-edit-form" style="display:none; margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-color);">
                <div class="form-group">
                   <label class="form-label">表示名</label>
                   <input type="text" id="editDisplayName" class="form-input" value="${this.escapeHtml(user.displayName || '')}">
                </div>
                <div class="form-group">
                   <label class="form-label">自己紹介</label>
                   <textarea id="editBio" class="form-textarea">${this.escapeHtml(user.bio || '')}</textarea>
                </div>
                <div class="form-group">
                   <label class="form-label">アイコン</label>
                   <div class="icon-preset-grid">
                     ${['👤', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐸', '🦄', '🐺', '🦋', '🌸', '💀', '👻', '🤖', '🎀', '✨', '🌙', '⭐', '💫', '🔥', '❄️', '🌈', '💜'].map(emoji => `
                       <button type="button" class="icon-preset-btn ${user.icon === emoji ? 'selected' : ''}" onclick="app.selectIconPreset('${emoji}')">${emoji}</button>
                     `).join('')}
                   </div>
                   <input type="hidden" id="editIconPreset" value="${user.icon && user.icon.length <= 4 ? user.icon : ''}">
                </div>
                <details class="mt-sm">
                   <summary class="text-muted text-sm" style="cursor:pointer;">🔧 上級者向け：カスタムURL</summary>
                   <div class="form-group mt-sm">
                      <input type="text" id="editIcon" class="form-input" placeholder="https://..." value="${user.icon && user.icon.startsWith('http') ? this.escapeHtml(user.icon) : ''}">
                      <p class="text-muted text-xs mt-xs">Discord/Imgur等の画像URLを入力</p>
                   </div>
                </details>
                <button class="btn btn-primary" onclick="app.saveProfile()">保存する</button>
             </div>
          </div>
          
          <div class="activity-heatmap card mt-md">
             <h3 class="section-sub-title">🔥 活動記録</h3>
             <div class="heatmap-container">
                ${this.generateHeatmapHTML(myLogs)}
             </div>
          </div>
       </div>

       <h3 class="section-title mt-xl">📂 自分の投稿 (${myLogs.length})</h3>
       ${myLogs.length === 0 ? '<p class="text-muted text-center">まだ投稿がありません</p>' : `
         <div class="log-grid">
           ${myLogs.map(log => this.createLogCard(log)).join('')}
         </div>
       `}
    `;
  }

  toggleProfileEdit() {
    const form = document.getElementById('profileEditForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  selectIconPreset(emoji) {
    // Update hidden input
    document.getElementById('editIconPreset').value = emoji;
    // Clear custom URL
    document.getElementById('editIcon').value = '';
    // Update visual selection
    document.querySelectorAll('.icon-preset-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.textContent === emoji);
    });
  }

  async saveProfile() {
    const dName = document.getElementById('editDisplayName').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    const customUrl = document.getElementById('editIcon').value.trim();
    const presetEmoji = document.getElementById('editIconPreset').value;

    // Priority: Custom URL > Preset Emoji
    const icon = customUrl || presetEmoji || '';

    if (!this.currentUser) return;

    try {
      await this.db.collection('users').doc(this.currentUser).set({
        displayName: dName,
        bio: bio,
        icon: icon,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      this.showToast('プロフィールを更新しました', 'success');
      this.toggleProfileEdit();
    } catch (e) {
      console.error(e);
      this.showToast('更新エラー: ' + e.message, 'error');
    }
  }


  generateHeatmapHTML(logs) {
    // Generate last 365 days squares
    // Simple implementation: last 12 weeks (approx 3 months) to save space
    const weeks = 12;
    const days = weeks * 7;
    const now = new Date();
    const squares = [];

    // Create map of date -> count
    const counts = {};
    logs.forEach(l => {
      const d = l.createdAt.split('T')[0];
      counts[d] = (counts[d] || 0) + 1;
    });

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = counts[dateStr] || 0;
      let level = 0;
      if (count > 0) level = 1;
      if (count > 1) level = 2;
      if (count > 3) level = 3;

      squares.push(`<div class="heatmap-day level-${level}" title="${dateStr}: ${count} posts"></div>`);
    }

    return squares.join('');
  }


  // ========================================
  // Social Features (Phase 4)
  // ========================================

  async addComment(logId) {
    if (!this.currentUser) { this.showToast('ログインしてください', 'error'); this.login(); return; }

    const text = document.getElementById('commentText').value.trim();
    if (!text) return;

    const log = this.logs.find(l => l.id === logId);
    if (!log) return;

    // Create comment object
    const newComment = {
      userId: this.currentUser, // UID
      userName: this.currentUserName, // Snapshot of name
      text: text,
      createdAt: new Date().toISOString().split('T')[0] // Simple date
    };

    try {
      await this.db.collection('logs').doc(logId).update({
        comments: firebase.firestore.FieldValue.arrayUnion(newComment)
      });
      this.showToast('コメントを投稿しました', 'success');
      // No need to manual push/render if listener is fast enough, but for UX:
      // (Listener will update eventually)
    } catch (e) {
      console.error(e);
      this.showToast('エラーが発生しました', 'error');
    }
  }

  async deleteComment(logId, idx) {
    if (!confirm('コメントを削除しますか？')) return;

    const log = this.logs.find(l => l.id === logId);
    if (!log || !log.comments) return;

    // Use a copy to modify
    const newComments = [...log.comments];
    newComments.splice(idx, 1);

    try {
      await this.db.collection('logs').doc(logId).update({ comments: newComments });
      this.showToast('コメントを削除しました');
    } catch (e) {
      console.error(e);
      this.showToast('削除エラー', 'error');
    }
  }

}

let app;
document.addEventListener('DOMContentLoaded', () => { app = new VRCKaibenApp(); });
