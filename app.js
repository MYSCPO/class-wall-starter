// ===================================================
// 우리 반 담벼락 - Firestore 연동
//
// 메모를 쓰면 올린 순서대로 담벼락에 붙습니다.
// 이제 데이터는 Firestore의 "memos" 컬렉션에 저장되어,
// 새로고침해도 사라지지 않고, 다른 사람 화면에도 실시간으로 반영됩니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyDeaBO3ENnerdYDaeXU8ruA6GKth2YvGPI",
  authDomain: "class-wall-test.firebaseapp.com",
  projectId: "class-wall-test",
  storageBucket: "class-wall-test.firebasestorage.app",
  messagingSenderId: "1037697542843",
  appId: "1:1037697542843:web:e07de6c37c97eae17d179e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// 메모가 저장되는 컬렉션
const memosCol = collection(db, "memos");

// --- 교사 UID 목록 ---
// 여기 적힌 uid로 로그인하면 "교사"로, 그 외에는 모두 "학생"으로 취급합니다.
// Firestore 규칙에도 똑같은 목록이 들어가 있어야 실제로 권한이 적용됩니다. (firestore.rules 참고)
//
// 내 uid 찾는 법: 구글로 한 번 로그인한 뒤,
// Firebase 콘솔 → Authentication → Users 탭에서 이메일 옆 "사용자 UID"를 복사하세요.
const TEACHER_UIDS = [
  // "여기에_교사_UID_붙여넣기"
];

function isTeacher(user) {
  return !!user && TEACHER_UIDS.includes(user.uid);
}


// --- 메모 목록 ---
// Firestore와 실시간으로 동기화되는 화면용 캐시입니다.
// createdAt 은 메모를 쓴 시각(밀리초)입니다. 이 값으로 순서를 정합니다.
let memos = [];

// 지금 로그인한 사용자 (로그인 안 했으면 null)
let currentUser = null;


// ===================================================
// 구글 로그인
// ===================================================

// 구글 계정으로 로그인합니다.
function signInWithGoogle() {
  signInWithPopup(auth, googleProvider).catch(function (error) {
    console.error("로그인에 실패했습니다:", error);
    alert("로그인에 실패했습니다. (" + error.code + ")");
  });
}

// 로그아웃합니다.
function signOutUser() {
  signOut(auth).catch(function (error) {
    console.error("로그아웃에 실패했습니다:", error);
  });
}

// 로그인 상태에 따라 #userArea 를 다시 그립니다.
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  userArea.innerHTML = "";

  if (currentUser) {
    const role = isTeacher(currentUser) ? "교사" : "학생";
    const name = document.createElement("span");
    name.textContent = (currentUser.displayName || currentUser.email) + "님 (" + role + ") ";
    userArea.appendChild(name);

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", signOutUser);
    userArea.appendChild(logoutBtn);

    input.disabled = false;
    input.placeholder = "메모를 쓰고 엔터";
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "구글로 로그인";
    loginBtn.addEventListener("click", signInWithGoogle);
    userArea.appendChild(loginBtn);

    input.disabled = true;
    input.placeholder = "로그인 후 메모를 쓸 수 있습니다";
  }
}

// 로그인 상태 변화를 계속 지켜봅니다.
function watchAuth() {
  onAuthStateChanged(auth, function (user) {
    currentUser = user;
    renderUserArea();
    render();
  });
}


// ===================================================
// 데이터를 다루는 함수 세 개
// 이제 Firestore를 읽고 쓰는 코드입니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 "memos" 컬렉션을 createdAt 순서로 실시간 구독합니다.
// 데이터가 바뀔 때마다(내가 쓰거나 지울 때, 다른 사람이 쓰거나 지울 때) 자동으로 다시 그립니다.
function loadMemos() {
  const q = query(memosCol, orderBy("createdAt"));
  onSnapshot(
    q,
    function (snapshot) {
      memos = snapshot.docs.map(function (docSnap) {
        const data = docSnap.data();
        return { id: docSnap.id, text: data.text, createdAt: data.createdAt, uid: data.uid };
      });
      render();
    },
    function (error) {
      // 여기로 오면 대부분 Firestore 콘솔 설정 문제입니다.
      // - "permission-denied": Firestore 규칙이 읽기/쓰기를 막고 있음
      // - "not-found": Firestore 데이터베이스 자체를 아직 만들지 않았음
      console.error("메모를 읽어오지 못했습니다:", error);
      alert("메모를 불러오지 못했습니다. (" + error.code + ")\n콘솔(F12)을 확인해 주세요.");
    }
  );
}

// 메모를 새로 씁니다.
// 누가 썼는지(uid)를 함께 저장합니다. 학생은 이 uid가 자기 것이어야만 쓸 수 있습니다.
function addMemo(text) {
  if (!currentUser) {
    alert("로그인 후 메모를 쓸 수 있습니다.");
    return;
  }

  addDoc(memosCol, {
    text: text,
    createdAt: Date.now(),
    uid: currentUser.uid
  }).catch(function (error) {
    console.error("메모를 저장하지 못했습니다:", error);
    alert("메모를 저장하지 못했습니다. (" + error.code + ")\n콘솔(F12)을 확인해 주세요.");
  });
}

// 메모를 지웁니다. (교사만 가능 - Firestore 규칙에서도 강제합니다)
function deleteMemo(id) {
  deleteDoc(doc(db, "memos", id)).catch(function (error) {
    console.error("메모를 지우지 못했습니다:", error);
    alert("메모를 지우지 못했습니다. (" + error.code + ")\n콘솔(F12)을 확인해 주세요.");
  });
}


// ===================================================
// 화면 그리기
// ===================================================

function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 삭제는 교사만 할 수 있습니다. 학생은 자기 메모라도 지울 권한이 없습니다.
  if (isTeacher(currentUser)) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", function () {
      deleteMemo(memo.id);
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");
input.disabled = true; // 로그인 확인 전까지는 잠가 둡니다.

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    addMemo(text);
    input.value = "";
  }
});


// 첫 화면 그리기 (Firestore 실시간 구독 + 로그인 상태 감시 시작)
loadMemos();
watchAuth();
input.focus();
