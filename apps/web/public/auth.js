(() => {
  const API = window.location.origin;
  const style = document.createElement('style');
  style.textContent = `
    .pro-auth-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:linear-gradient(135deg,#07111f,#101b35);padding:20px;font-family:system-ui,-apple-system,sans-serif}
    .pro-auth-card{width:min(420px,100%);background:#fff;border-radius:24px;padding:30px;box-shadow:0 24px 80px #0008;color:#101828}
    .pro-auth-logo{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:#111827;color:#fff;font-size:26px;font-weight:800;margin-bottom:16px}
    .pro-auth-card h1{margin:0 0 6px;font-size:28px}.pro-auth-card p{margin:0 0 22px;color:#667085}
    .pro-auth-card label{display:block;font-size:13px;font-weight:700;margin:12px 0 6px}.pro-auth-card input{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:12px;padding:12px 13px;font-size:15px;outline:none}.pro-auth-card input:focus{border-color:#111827;box-shadow:0 0 0 3px #11182712}
    .pro-auth-primary{width:100%;border:0;border-radius:12px;padding:13px;margin-top:18px;background:#111827;color:#fff;font-size:15px;font-weight:700;cursor:pointer}.pro-auth-primary:disabled{opacity:.6;cursor:wait}
    .pro-auth-switch,.pro-auth-forgot{border:0;background:none;color:#344054;cursor:pointer;font-size:14px}.pro-auth-switch{margin-top:16px;width:100%;text-decoration:underline}.pro-auth-forgot{display:block;margin:12px auto 0;text-decoration:underline}.pro-auth-error{min-height:20px;margin-top:12px;color:#b42318;font-size:13px}.pro-auth-success{color:#027a48}.pro-auth-note{font-size:12px;color:#667085;margin-top:14px;text-align:center;line-height:1.5}
  `;
  document.head.appendChild(style);

  const originalFetch = window.fetch.bind(window);
  const request = async (path, body) => {
    const r = await originalFetch(API + path, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  function saveUser(user) {
    localStorage.setItem('pro-chat-user-v3', JSON.stringify(user));
    location.reload();
  }

  function mount() {
    if (document.querySelector('.pro-auth-overlay')) return;
    const existing = (() => { try { return JSON.parse(localStorage.getItem('pro-chat-user-v3')); } catch { return null; } })();
    if (existing?.token) return;
    const overlay = document.createElement('div');
    overlay.className = 'pro-auth-overlay';
    overlay.innerHTML = `<div class="pro-auth-card"><div class="pro-auth-logo">P</div><h1>Welcome to Pro Chat</h1><p id="pro-auth-sub">Create your account to start messaging.</p><div id="pro-auth-fields"></div><div class="pro-auth-error" id="pro-auth-msg"></div><button class="pro-auth-primary" id="pro-auth-submit">Create Account</button><button class="pro-auth-switch" id="pro-auth-switch">Already have an account? Login</button><button class="pro-auth-forgot" id="pro-auth-forgot">Forgot Password?</button><div class="pro-auth-note">Your password is securely hashed on the server. You can use your username, email, or phone number to log in.</div></div>`;
    document.body.appendChild(overlay);
    const fields = overlay.querySelector('#pro-auth-fields'), submit = overlay.querySelector('#pro-auth-submit'), sw = overlay.querySelector('#pro-auth-switch'), forgot = overlay.querySelector('#pro-auth-forgot'), msg = overlay.querySelector('#pro-auth-msg'), sub = overlay.querySelector('#pro-auth-sub');
    let register = true;
    const input = (id,label,type,placeholder) => `<label for="${id}">${label}</label><input id="${id}" type="${type}" placeholder="${placeholder}" autocomplete="${type==='password'?'new-password':'on'}">`;
    function render() {
      msg.textContent=''; msg.className='pro-auth-error';
      if (register) {
        sub.textContent='Create your account to start messaging.';
        fields.innerHTML = input('email','Email','email','you@example.com') + input('phone','Phone number','tel','+91 9876543210') + input('username','Username','text','Choose a username') + input('password','Password','password','Create a password') + input('confirm','Confirm password','password','Re-enter your password');
        submit.textContent='Create Account'; sw.textContent='Already have an account? Login'; forgot.style.display='none';
      } else {
        sub.textContent='Login with your username, email, or phone number.';
        fields.innerHTML = input('identifier','Username, Email or Phone','text','Username / email / phone') + input('password','Password','password','Your password');
        submit.textContent='Login'; sw.textContent='New to Pro Chat? Create Account'; forgot.style.display='block';
      }
    }
    render();
    sw.onclick=()=>{register=!register;render()};
    forgot.onclick=async()=>{
      const identifier=fields.querySelector('#identifier')?.value.trim();
      if(!identifier){msg.textContent='Enter your email, username, or phone number first.';return;}
      try{const d=await request('/api/auth/forgot-password',{identifier});msg.textContent=d.message||'If the account exists, password reset instructions have been requested.';msg.className='pro-auth-error pro-auth-success'}catch(e){msg.textContent=e.message}
    };
    submit.onclick=async()=>{
      msg.textContent='';submit.disabled=true;
      try {
        let user;
        if(register){
          const email=fields.querySelector('#email').value.trim(),phoneNumber=fields.querySelector('#phone').value.trim(),username=fields.querySelector('#username').value.trim(),password=fields.querySelector('#password').value,confirm=fields.querySelector('#confirm').value;
          if(!email||!phoneNumber||!username||!password||!confirm) throw Error('Please fill in all fields.');
          if(password!==confirm) throw Error('Passwords do not match.');
          user=await request('/api/auth/register',{email,phoneNumber,username,password});
        } else {
          const identifier=fields.querySelector('#identifier').value.trim(),password=fields.querySelector('#password').value;
          if(!identifier||!password) throw Error('Enter your login details.');
          user=await request('/api/auth/login',{identifier,password});
        }
        saveUser(user);
      } catch(e) { msg.textContent=e.message||'Unable to complete request.'; } finally { submit.disabled=false; }
    };
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount); else mount();
})();
