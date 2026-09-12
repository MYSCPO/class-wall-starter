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

// 메모가 저장되는 컬렉션
const memosCol = collection(db, "memos");


// --- 메모 목록 ---
// Firestore와 실시간으로 동기화되는 화면용 캐시입니다.
// createdAt 은 메모를 쓴 시각(밀리초)입니다. 이 값으로 순서를 정합니다.
let memos = [];


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
        return { id: docSnap.id, text: data.text, createdAt: data.createdAt };
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
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
function addMemo(text) {
  addDoc(memosCol, {
    text: text,
    createdAt: Date.now()
  }).catch(function (error) {
    console.error("메모를 저장하지 못했습니다:", error);
    alert("메모를 저장하지 못했습니다. (" + error.code + ")\n콘솔(F12)을 확인해 주세요.");
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", function () {
    deleteMemo(memo.id);
  });
  div.appendChild(del);

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

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    addMemo(text);
    input.value = "";
  }
});


// 첫 화면 그리기 (Firestore 실시간 구독 시작)
loadMemos();
input.focus();
