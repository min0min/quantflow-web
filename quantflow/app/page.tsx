"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Asset = "BTC" | "ETH" | "XAUUSD";
type Side = "Long" | "Short";
type Result = "익절" | "손절 지킴" | "손절 실패";
type FilterMode = "전체" | "손실만" | "수익만" | "손절 실패";
type CashFlowType = "입금" | "출금";

type Trade = {
  id: string;
  asset: Asset;
  side: Side;
  pnl: number;
  result: Result;
  note: string;
  date: string;
  time: string;
};

type CashFlow = {
  id: string;
  type: CashFlowType;
  amount: number;
  note: string;
  date: string;
  time: string;
};

const assets = [
  {
    symbol: "BTC" as Asset,
    category: "CRYPTO",
    name: "BITCOIN",
    label: "BTC / SYMBOL",
    accent: "border-orange-500 text-orange-400",
  },
  {
    symbol: "ETH" as Asset,
    category: "CRYPTO",
    name: "ETHEREUM",
    label: "ETH / SYMBOL",
    accent: "border-blue-500 text-blue-400",
  },
  {
    symbol: "XAUUSD" as Asset,
    category: "COMMODITIES",
    name: "GOLD",
    label: "XAU / SYMBOL",
    accent: "border-yellow-500 text-yellow-400",
  },
];

function getKoreaDateTime() {
  const now = new Date();
  const korea = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );

  return {
    date: korea.toISOString().slice(0, 10),
    time: korea.toTimeString().slice(0, 5),
  };
}

function todayKoreaString() {
  return getKoreaDateTime().date;
}

function pnlColor(value: number) {
  if (value > 0) return "text-green-400";
  if (value < 0) return "text-red-400";
  return "text-white";
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  type UserRole = "admin" | "viewer";
const [role, setRole] = useState<UserRole>("viewer");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [friendEmail, setFriendEmail] = useState("");

  const [selectedAsset, setSelectedAsset] = useState<Asset>("BTC");
  const [selectedDate, setSelectedDate] = useState(todayKoreaString());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [initialCapital, setInitialCapital] = useState("0");
  const [totalAsset, setTotalAsset] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const [side, setSide] = useState<Side>("Long");
  const [pnl, setPnl] = useState("");
  const [result, setResult] = useState<Result>("익절");
  const [note, setNote] = useState("");

  const [cashType, setCashType] = useState<CashFlowType>("입금");
  const [cashAmount, setCashAmount] = useState("");
  const [cashNote, setCashNote] = useState("");

async function login() {
  if (!loginEmail) {
    alert("이메일을 입력해줘.");
    return;
  }

 const { error } = await supabase.auth.signInWithPassword({
  email: loginEmail,
  password: loginPassword,
});

  if (error) {
    console.error("로그인 실패:", error);
    alert("로그인 실패. 이메일/비밀번호를 확인해줘.");
    return;
  }

  alert("로그인 완료!");
}

async function signUp() {
  if (!loginEmail || !loginPassword) {
    alert("이메일과 비밀번호를 입력해줘.");
    return;
  }

  const { error } = await supabase.auth.signUp({
    email: loginEmail,
    password: loginPassword,
  });

  if (error) {
    console.error("회원가입 실패:", error);
    alert("회원가입 실패");
    return;
  }

  alert("회원가입 완료! 이제 로그인해줘.");
}
async function updatePassword() {
  if (!loginPassword) {
    alert("새 비밀번호를 입력해줘.");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: loginPassword,
  });

  if (error) {
    console.error("비밀번호 설정 실패:", error);
    alert("비밀번호 설정 실패");
    return;
  }

  alert("비밀번호 설정 완료! 이제 다시 로그인해줘.");
}

async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("로그아웃 실패:", error);
    alert("로그아웃 실패");
    return;
  }

  setUser(null);
  alert("로그아웃 완료!");
}

  async function saveInitialCapital(value: string) {
  const { error } = await supabase
    .from("settings")
    .upsert(
      {
        key: "initialCapital",
        value,
      },
      {
        onConflict: "key",
      }
    );

  if (error) {
    console.error("시작 총자산 저장 실패:", error);
    alert("시작 총자산 저장 실패!");
  }
}

  async function fetchTrades(currentUser = user) {
  if (!currentUser) return;

  const { data: sharedAccessData } = await supabase
    .from("shared_access")
    .select("owner_id")
    .eq("viewer_email", currentUser.email);

  const sharedOwnerIds = sharedAccessData?.map((item) => item.owner_id) ?? [];
  const accessibleUserIds = [currentUser.id, ...sharedOwnerIds];

  const { data: tradesData, error: tradesError } = await supabase
    .from("trades")
    .select("*")
    .in("user_id", accessibleUserIds)
    .order("created_at", { ascending: false });

  if (tradesError) {
    console.error("trades 불러오기 실패:", tradesError);
  } else {
    setTrades(tradesData || []);
  }

  const { data: cashData, error: cashError } = await supabase
    .from("cashflows")
    .select("*")
    .in("user_id", accessibleUserIds)
    .order("created_at", { ascending: false });

  if (cashError) {
    console.error("cashflows 불러오기 실패:", cashError);
  } else {
    setCashFlows(cashData || []);
  }

  const { data: settingData, error: settingError } = await supabase
  .from("settings")
  .select("*")
  .eq("key", "initialCapital")
  .maybeSingle();

if (settingError) {
  console.error("settings 불러오기 실패:", settingError);
} else if (settingData) {
  setInitialCapital(settingData.value);
}
}

  const [filterMode, setFilterMode] = useState<FilterMode>("전체");
  const [filterAsset, setFilterAsset] = useState<"ALL" | Asset>("ALL");
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
  async function checkSession() {
    const { data } = await supabase.auth.getSession();

    setUser(data.session?.user ?? null);

    if (data.session?.user) {
      await supabase.from("profiles").upsert(
  {
    user_id: data.session.user.id,
    email: data.session.user.email,
    role: data.session.user.email === "youmin082987@gmail.com" ? "admin" : "viewer",
  },
  {
    onConflict: "user_id",
  }
);
const { data: profileData} = await supabase
  .from("profiles")
  .select("role")
  .eq("user_id", data.session.user.id)
  .single();

if (profileData) {
  setRole(profileData.role);
}

    await fetchTrades(data.session.user);
    }

    setIsLoaded(true);
  }

  checkSession();

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);

    if (session?.user) {
     fetchTrades(session.user);
    }
  });

  const tradesChannel = supabase
  .channel("trades-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "trades" },
    () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) fetchTrades(data.user);
      });
    }
  )
  .subscribe();

const cashflowsChannel = supabase
  .channel("cashflows-realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "cashflows" },
    () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) fetchTrades(data.user);
      });
    }
  )
  .subscribe();

 return () => {
  listener.subscription.unsubscribe();
  supabase.removeChannel(tradesChannel);
  supabase.removeChannel(cashflowsChannel);
};
}, []);


  const selectedMonth = selectedDate.slice(0, 7);
  const selectedYear = selectedDate.slice(0, 4);

  const stats = useMemo(() => {
    const dayTrades = trades.filter((t) => t.date === selectedDate);
    const monthTrades = trades.filter((t) => t.date.startsWith(selectedMonth));
    const yearTrades = trades.filter((t) => t.date.startsWith(selectedYear));

    const sum = (list: Trade[]) => list.reduce((acc, t) => acc + t.pnl, 0);
    const wins = trades.filter((t) => t.pnl > 0).length;
    const ruleKept = trades.filter(
      (t) => t.result === "익절" || t.result === "손절 지킴"
    ).length;

    return {
      dayPnl: sum(dayTrades),
      monthPnl: sum(monthTrades),
      yearPnl: sum(yearTrades),
      totalPnl: sum(trades),
      tradeCount: trades.length,
      winRate: trades.length ? Math.round((wins / trades.length) * 100) : 0,
      ruleRate: trades.length ? Math.round((ruleKept / trades.length) * 100) : 0,
    };
  }, [trades, selectedDate, selectedMonth, selectedYear]);

  const capitalStats = useMemo(() => {
    const startCapital = Number(initialCapital) || 0;
    const depositTotal = cashFlows
      .filter((c) => c.type === "입금")
      .reduce((sum, c) => sum + c.amount, 0);
    const withdrawTotal = cashFlows
      .filter((c) => c.type === "출금")
      .reduce((sum, c) => sum + c.amount, 0);

    const netCashFlow = depositTotal - withdrawTotal;
    const capitalBase = startCapital + netCashFlow;
    const currentBalance = capitalBase + stats.totalPnl;
    const roi = capitalBase > 0 ? (stats.totalPnl / capitalBase) * 100 : 0;

    return {
      startCapital,
      depositTotal,
      withdrawTotal,
      netCashFlow,
      capitalBase,
      currentBalance,
      roi,
    };
  }, [initialCapital, cashFlows, stats.totalPnl]);

  const chartData = useMemo(() => {
    const dailyMap: Record<string, number> = {};

    trades.forEach((trade) => {
      if (!dailyMap[trade.date]) dailyMap[trade.date] = 0;
      dailyMap[trade.date] += trade.pnl;
    });

    let cumulative = 0;

    return Object.keys(dailyMap)
      .sort()
      .map((date) => {
        cumulative += dailyMap[date];

        return {
          date,
          daily: dailyMap[date],
          cumulative,
        };
      });
  }, [trades]);

  const filteredTrades = trades.filter(
    (trade) => trade.asset === selectedAsset && trade.date === selectedDate
  );

  const searchTrades = useMemo(() => {
    return trades
      .filter((trade) => {
        if (filterMode === "손실만" && trade.pnl >= 0) return false;
        if (filterMode === "수익만" && trade.pnl <= 0) return false;
        if (filterMode === "손절 실패" && trade.result !== "손절 실패") return false;
        if (filterAsset !== "ALL" && trade.asset !== filterAsset) return false;

        if (searchText.trim()) {
          const target = `${trade.asset} ${trade.side} ${trade.result} ${trade.note} ${trade.date} ${trade.time}`;
          return target.toLowerCase().includes(searchText.toLowerCase());
        }

        return true;
      })
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [trades, filterMode, filterAsset, searchText]);

  const searchStats = useMemo(() => {
    const total = searchTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const losses = searchTrades.filter((trade) => trade.pnl < 0);
    const lossTotal = losses.reduce((sum, trade) => sum + trade.pnl, 0);

    return {
      count: searchTrades.length,
      total,
      lossTotal,
      avgLoss: losses.length ? Math.round(lossTotal / losses.length) : 0,
    };
  }, [searchTrades]);

  function getAssetPnl(asset: Asset) {
    return trades
      .filter((trade) => trade.asset === asset)
      .reduce((sum, trade) => sum + trade.pnl, 0);
  }

  async function addTrade() {
    if (!user) {
  alert("로그인이 필요합니다.");
  return;
}
if (role !== "admin") {
  alert("관리자만 매매 기록을 추가할 수 있습니다.");
  return;
}
    const numberPnl = Number(pnl);

    if (!pnl || Number.isNaN(numberPnl)) {
      alert("손익 숫자를 입력해줘. 예: 120 또는 -80");
      return;
    }

    const koreaNow = getKoreaDateTime();

    const newTrade = {
  asset: selectedAsset,
  side,
  pnl: numberPnl,
  result,
  note,
  date: selectedDate || koreaNow.date,
  time: koreaNow.time,
  user_id: user.id,
};

const { data, error } = await supabase
  .from("trades")
  .insert([newTrade])
  .select()
  .single();

if (error) {
  console.error("매매 기록 저장 실패:", error);
  alert("매매 기록 저장에 실패했어.");
  return;
}

    await fetchTrades();

setPnl("");
setNote("");

alert("✅ 매매 기록 저장 완료!");
  }
  async function inviteFriend() {
  if (role !== "admin") {
    alert("관리자만 친구를 초대할 수 있습니다.");
    return;
  }

  if (!friendEmail) {
    alert("이메일을 입력해주세요.");
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: friendEmail,
  });

  if (error) {
    console.error("초대 실패:", error);
    alert("초대 메일 전송 실패");
    return;
  }

  const { error: shareError } = await supabase
  .from("shared_access")
  .insert({
    owner_id: user?.id,
    viewer_email: friendEmail,
  });

if (shareError) {
  console.error("공유 등록 실패:", shareError);
  alert("공유 등록 실패");
  return;
}

alert("✅ 초대 + 공유 설정 완료!");
setFriendEmail("");
}

  
  async function addCashFlow() {
    if (!user) {
    alert("로그인이 필요합니다.");
    return;
  }

  if (role !== "admin") {
  alert("관리자만 입출금 기록을 추가할 수 있습니다.");
  return;
}

    const numberAmount = Number(cashAmount);

    if (!cashAmount || Number.isNaN(numberAmount) || numberAmount <= 0) {
      alert("입금/출금 금액을 숫자로 입력해줘. 예: 500");
      return;
    }

    const koreaNow = getKoreaDateTime();

    const newCashFlow = {
  type: cashType,
  amount: numberAmount,
  note: cashNote,
  date: selectedDate || koreaNow.date,
  time: koreaNow.time,
   user_id: user.id,
};

const { data, error } = await supabase
  .from("cashflows")
  .insert([newCashFlow])
  .select()
  .single();

if (error) {
  console.error("입출금 기록 저장 실패:", error);
  alert("입출금 기록 저장에 실패했어.");
  return;
}

    await fetchTrades();

setCashAmount("");
setCashNote("");

alert("✅ 입출금 기록 저장 완료!");
  }

  async function deleteTrade(id: string) {
    if (role !== "admin") {
    alert("관리자만 매매 기록을 삭제할 수 있습니다.");
    return;
  }
  const ok = confirm("이 매매 기록 삭제할까?");
  if (!ok) return;

  const { error } = await supabase
    .from("trades")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("삭제 실패:", error);
    alert("삭제 실패");
    return;
  }

  await fetchTrades();

  alert("🗑 삭제 완료!");
}

  async function deleteCashFlow(id: string) {
    if (role !== "admin") {
    alert("관리자만 입출금 기록을 삭제할 수 있습니다.");
    return;
  }

  const ok = confirm("이 입출금 기록 삭제할까?");
  if (!ok) return;

  const { error } = await supabase
    .from("cashflows")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("입출금 삭제 실패:", error);
    alert("입출금 삭제 실패");
    return;
  }

  await fetchTrades();

  alert("🗑 입출금 삭제 완료!");
}
function calculateTotalAsset() {
  const initial = Number(initialCapital || 0);

  const cashSum = cashFlows.reduce((sum, cash) => {
    const sign = cash.type === "출금" ? -1 : 1;
    return sum + sign * Number(cash.amount || 0);
  }, 0);

  const tradeSum = trades.reduce((sum, trade) => {
    return sum + Number(trade.pnl || 0);
  }, 0);

  setTotalAsset(initial + cashSum + tradeSum);
}
useEffect(() => {
  calculateTotalAsset();
}, [initialCapital, cashFlows, trades]);
  function setToday() {
    setSelectedDate(todayKoreaString());
  }
if (!user) {
  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center relative overflow-hidden">
      {/* premium background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,rgba(255,122,24,0.12),transparent_32%,rgba(59,130,246,0.10))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:34px_34px] opacity-[0.18]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.75))]" />

      {/* glow objects */}
      <div className="absolute -top-56 -left-44 w-[760px] h-[760px] rounded-full bg-orange-500/20 blur-[170px]" />
      <div className="absolute -bottom-56 -right-44 w-[680px] h-[680px] rounded-full bg-sky-500/20 blur-[170px]" />
      <div className="absolute top-1/2 left-1/2 w-[420px] h-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-[120px]" />

      {/* orbit lines */}
      <div className="absolute w-[900px] h-[900px] border border-white/[0.04] rounded-full" />
      <div className="absolute w-[650px] h-[650px] border border-orange-400/[0.07] rounded-full rotate-12" />

      {/* particles */}
      <div className="absolute top-[18%] left-[18%] w-1.5 h-1.5 bg-orange-300 rounded-full animate-pulse" />
      <div className="absolute top-[30%] right-[24%] w-1 h-1 bg-white rounded-full animate-ping" />
      <div className="absolute bottom-[24%] left-[30%] w-1.5 h-1.5 bg-sky-300 rounded-full animate-pulse" />
      <div className="absolute bottom-[38%] right-[34%] w-1 h-1 bg-orange-400 rounded-full animate-ping" />

      {/* brand bar */}
      <div className="absolute top-8 left-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.08)]">
          <span className="text-orange-400 font-black">Q</span>
        </div>
        <div>
          <p className="text-sm font-bold tracking-[0.25em]">QUANTFLOW</p>
          <p className="text-[10px] text-zinc-500 tracking-[0.3em]">PRIVATE TERMINAL</p>
        </div>
      </div>

      {/* main card */}
      <div className="relative z-10 w-full max-w-[520px] mx-4">
        <div className="absolute -inset-[1px] rounded-[2rem] bg-gradient-to-br from-orange-400/60 via-white/10 to-sky-500/50 blur-sm opacity-70" />

        <div className="relative backdrop-blur-2xl bg-zinc-950/70 border border-white/10 rounded-[2rem] p-9 shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between mb-8">
            <span className="text-[11px] tracking-[0.35em] text-orange-300">
              AI TRADING JOURNAL
            </span>
            <span className="text-[10px] px-3 py-1 rounded-full border border-white/10 bg-white/5 text-zinc-400">
              SECURE ACCESS
            </span>
          </div>

          <h1 className="text-5xl font-black leading-[0.9] tracking-tight">
            QuantFlow
            <br />
            <span className="text-2xl font-semibold text-zinc-400 tracking-normal">
              Login
            </span>
          </h1>

          <p className="mt-6 text-sm leading-6 text-zinc-400">
            Powered by AI-style trading discipline.
            <br />
            자산 · 입출금 · 손익 기록을 안전하게 관리하세요.
          </p>

          <div className="mt-8 space-y-4">
            <input
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="이메일 입력"
              className="w-full p-4 rounded-2xl bg-black/60 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-400/70 focus:border-orange-300/40 transition"
            />
            <input
  type="password"
  placeholder="비밀번호 입력"
  value={loginPassword}
  onChange={(e) => setLoginPassword(e.target.value)}
  className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-zinc-500 outline-none"
/>

            <button
              onClick={login}
              className="group w-full p-4 rounded-2xl font-black bg-gradient-to-r from-orange-500 via-amber-300 to-orange-500 text-black hover:scale-[1.015] active:scale-[0.985] transition shadow-[0_0_45px_rgba(249,115,22,0.38)]"
            >
              로그인
              <span className="inline-block ml-2 group-hover:translate-x-1 transition">
                →
              </span>
            </button>

            <button
  onClick={signUp}
  className="w-full p-4 rounded-2xl border border-white/10 text-white bg-white/5 hover:bg-white/10 transition"
>
  회원가입
</button>

<button
  onClick={updatePassword}
  className="w-full p-4 rounded-2xl border border-orange-500/30 text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 transition"
>
  비밀번호 설정
</button>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
              <p className="text-[10px] text-zinc-500">MODE</p>
              <p className="text-xs font-bold mt-1">PRIVATE</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
              <p className="text-[10px] text-zinc-500">DATA</p>
              <p className="text-xs font-bold mt-1">SUPABASE</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
              <p className="text-[10px] text-zinc-500">ACCESS</p>
              <p className="text-xs font-bold mt-1">EMAIL</p>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 text-[10px] text-zinc-600 tracking-[0.45em]">
        BUILT FOR DISCIPLINED TRADERS
      </div>
    </main>
  );
}
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <section className="max-w-7xl mx-auto">
        <div className="flex justify-between gap-4 items-start">
          <div>
            <h1 className="text-4xl font-bold">QuantFlow</h1>
            <p className="text-zinc-400 mt-2">
              달력 기반 오토로직 매매 기록 · 자산/입출금/손익률 관리(유민/동혁)
            </p>
          </div>
          
         <button
    onClick={logout}
    className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700 transition"
  >
    로그아웃
  </button>

<input
  type="password"
  placeholder="새 비밀번호 입력"
  value={loginPassword}
  onChange={(e) => setLoginPassword(e.target.value)}
  className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder:text-zinc-500"
/>

<button
  onClick={updatePassword}
  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-sm font-bold text-white transition"
>
  비밀번호 설정
</button>

  {role === "admin" && (
  <div className="mt-4 flex gap-2">
    <input
      type="email"
      placeholder="친구 이메일 입력"
      value={friendEmail}
      onChange={(e) => setFriendEmail(e.target.value)}
      className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-white placeholder:text-zinc-500"
    />

    <button
      onClick={inviteFriend}
      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white transition"
    >
      친구 초대
    </button>
  </div>
)}



          <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-2">날짜 선택</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-black border border-zinc-700 rounded-xl p-3"
              />
              <button
                onClick={setToday}
                className="bg-white text-black rounded-xl px-4 font-bold hover:bg-zinc-200"
              >
                오늘
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              기록 시간은 한국 현재 시간으로 자동 저장됩니다.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mt-8">
          <Card title="시작 총자산" value={`$${capitalStats.startCapital}`} />
          <Card title="순입출금" value={`$${capitalStats.netCashFlow}`} color={pnlColor(capitalStats.netCashFlow)} />
          <Card title="매매 손익" value={`$${stats.totalPnl}`} color={pnlColor(stats.totalPnl)} />
          <Card title="현재 자산" value={`$${capitalStats.currentBalance}`} color={pnlColor(capitalStats.currentBalance - capitalStats.capitalBase)} />
          <Card title="자산 대비 수익률" value={`${capitalStats.roi.toFixed(2)}%`} color={pnlColor(capitalStats.roi)} />
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <Card title="금일 손익" value={`$${stats.dayPnl}`} color={pnlColor(stats.dayPnl)} />
          <Card title="월별 손익" value={`$${stats.monthPnl}`} color={pnlColor(stats.monthPnl)} />
          <Card title="연별 손익" value={`$${stats.yearPnl}`} color={pnlColor(stats.yearPnl)} />
          <Card title="전체 손익" value={`$${stats.totalPnl}`} color={pnlColor(stats.totalPnl)} />
        </div>

        <div className="grid grid-cols-5 gap-5 mt-5">
          <Card title="현재 총 자산" value={`$${Number(totalAsset || 0).toLocaleString('en-US', { minimumFractionDigits: 2 
            })}`} 
          color={pnlColor(totalAsset - Number(initialCapital || 0))}
          />
          <Card title="총 매매 횟수" value={`${stats.tradeCount}회`} />
          <Card title="승률" value={`${stats.winRate}%`} />
          <Card title="규칙 준수율" value={`${stats.ruleRate}%`} />
          <Card title="선택 날짜" value={selectedDate} />
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">자산 설정</h2>

            <label className="text-sm text-zinc-400">시작 총자산</label>
            <input
              value={initialCapital}
              onChange={(e) => {
  setInitialCapital(e.target.value);
  saveInitialCapital(e.target.value);
}}
              placeholder="예: 2000"
              className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700"
            />

            <p className="text-sm text-zinc-500">
              현재 자산 = 시작 총자산 + 순입출금 + 매매 손익
            </p>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">입출금 기록 추가</h2>

            <label className="text-sm text-zinc-400">구분</label>
            <select
              value={cashType}
              onChange={(e) => setCashType(e.target.value as CashFlowType)}
              className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700"
            >
              <option>입금</option>
              <option>출금</option>
            </select>

            <label className="text-sm text-zinc-400">금액</label>
            <input
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="예: 500"
              className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700"
            />

            <label className="text-sm text-zinc-400">메모</label>
            <input
              value={cashNote}
              onChange={(e) => setCashNote(e.target.value)}
              placeholder="예: 추가 입금 / 일부 출금"
              className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700"
            />

            <button
              onClick={addCashFlow}
              className="w-full bg-white text-black font-bold p-3 rounded-xl hover:bg-zinc-200"
            >
              입출금 추가
            </button>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">최근 입출금 내역</h2>

            {cashFlows.length === 0 ? (
              <div className="text-zinc-500 py-8 text-center">
                아직 입출금 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-3 max-h-[245px] overflow-y-auto">
                {cashFlows.map((cash) => (
                  <div
                    key={cash.id}
                    className="grid grid-cols-[1.4fr_0.8fr_1fr_1.5fr_30px] gap-2 text-sm border-b border-zinc-800 pb-2 items-center"
                  >
                    <span className="text-zinc-400">
                      {cash.date} {cash.time}
                    </span>
                    <span>{cash.type}</span>
                    <span className={cash.type === "입금" ? "text-green-400" : "text-red-400"}>
                      ${cash.amount}
                    </span>
                    <span className="text-zinc-400">{cash.note || "-"}</span>
                    <button
                      onClick={() => deleteCashFlow(cash.id)}
                      className="text-zinc-500 hover:text-red-400 text-xl font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
          <h2 className="text-xl font-bold mb-1">손익 그래프</h2>
          <p className="text-sm text-zinc-400 mb-4">
            초록선은 일별 손익, 파란선은 누적 손익입니다.
          </p>

          {chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-zinc-500">
              아직 그래프에 표시할 매매 기록이 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#333" />
                <XAxis dataKey="date" stroke="#aaa" />
                <YAxis stroke="#aaa" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: "12px",
                    color: "white",
                  }}
                />
                <Line type="monotone" dataKey="daily" stroke="#22c55e" strokeWidth={3} name="일별 손익" />
                <Line type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={3} name="누적 손익" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <h2 className="text-2xl font-bold mt-10 mb-4">자산 선택</h2>

        <div className="grid grid-cols-3 gap-4">
          {assets.map((asset) => {
            const assetPnl = getAssetPnl(asset.symbol);
            const selected = selectedAsset === asset.symbol;

            return (
              <button
                key={asset.symbol}
                onClick={() => setSelectedAsset(asset.symbol)}
                className={`relative overflow-hidden text-left min-h-[210px] rounded-2xl p-6 border transition ${
                  selected
                    ? `bg-zinc-950 ${asset.accent}`
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-500"
                }`}
              >
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_#ffffff33,_transparent_35%)]" />
                <div className="relative z-10">
                  <p className="text-xs tracking-[0.35em] text-zinc-500">{asset.category}</p>
                  <h3 className={`text-5xl font-black mt-8 tracking-tight ${selected ? asset.accent.split(" ")[1] : "text-white"}`}>
                    {asset.name}
                  </h3>
                  <p className="text-zinc-400 mt-2 tracking-widest">{asset.label}</p>
                  <p className="mt-8 text-sm text-zinc-400">
                    전체 누적 손익: <span className={pnlColor(assetPnl)}>${assetPnl}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">
              {selectedDate} · {selectedAsset} 매매 추가
            </h2>

            <label className="text-sm text-zinc-400">방향</label>
            <select value={side} onChange={(e) => setSide(e.target.value as Side)} className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700">
              <option>Long</option>
              <option>Short</option>
            </select>

            <label className="text-sm text-zinc-400">손익</label>
            <input value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="예: 120 / -80" className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700" />

            <label className="text-sm text-zinc-400">결과</label>
            <select value={result} onChange={(e) => setResult(e.target.value as Result)} className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700">
              <option>익절</option>
              <option>손절 지킴</option>
              <option>손절 실패</option>
            </select>

            <label className="text-sm text-zinc-400">메모</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 손절 늦음 / 진입 근거 좋음" className="w-full mt-1 mb-4 p-3 rounded-xl bg-black border border-zinc-700" />

            <button onClick={addTrade} className="w-full bg-white text-black font-bold p-3 rounded-xl hover:bg-zinc-200">
              기록 추가
            </button>
          </div>

          <div className="col-span-2 bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">
              {selectedDate} · {selectedAsset} 매매 기록
            </h2>

            {filteredTrades.length === 0 ? (
              <div className="text-zinc-500 py-10 text-center">
                선택한 날짜의 {selectedAsset} 매매 기록이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} onDelete={deleteTrade} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
          <div className="flex justify-between gap-4 items-start mb-5">
            <div>
              <h2 className="text-xl font-bold">전체 매매 검색</h2>
              <p className="text-sm text-zinc-400 mt-1">
                과거 손실 거래, 손절 실패, 자산별 기록을 날짜/시간과 함께 확인합니다.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                className="bg-black border border-zinc-700 rounded-xl p-3"
              >
                <option>전체</option>
                <option>손실만</option>
                <option>수익만</option>
                <option>손절 실패</option>
              </select>

              <select
                value={filterAsset}
                onChange={(e) => setFilterAsset(e.target.value as "ALL" | Asset)}
                className="bg-black border border-zinc-700 rounded-xl p-3"
              >
                <option value="ALL">전체 자산</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="XAUUSD">XAUUSD</option>
              </select>

              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="메모/자산/결과 검색"
                className="bg-black border border-zinc-700 rounded-xl p-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <Card title="검색된 거래 수" value={`${searchStats.count}회`} />
            <Card title="검색 결과 총합" value={`$${searchStats.total}`} color={pnlColor(searchStats.total)} />
            <Card title="손실 평균" value={`$${searchStats.avgLoss}`} color={pnlColor(searchStats.avgLoss)} />
          </div>

          {searchTrades.length === 0 ? (
            <div className="text-zinc-500 py-10 text-center">
              조건에 맞는 매매 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {searchTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_1.5fr_40px] gap-3 border-b border-zinc-800 pb-3 text-sm items-center"
                >
                  <span className="text-zinc-400">
                    {trade.date} {trade.time}
                  </span>
                  <span>{trade.asset}</span>
                  <span>{trade.side}</span>
                  <span className={pnlColor(trade.pnl)}>${trade.pnl}</span>
                  <span>{trade.result}</span>
                  <span className="text-zinc-400">{trade.note || "-"}</span>
                  <button
                    onClick={() => deleteTrade(trade.id)}
                    className="text-zinc-500 hover:text-red-400 text-xl font-bold"
                    title="삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function TradeRow({
  trade,
  onDelete,
}: {
  trade: Trade;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_2fr_40px] gap-3 border-b border-zinc-800 pb-3 text-sm items-center">
      <span className="text-zinc-400">{trade.time}</span>
      <span>{trade.asset}</span>
      <span>{trade.side}</span>
      <span className={pnlColor(trade.pnl)}>${trade.pnl}</span>
      <span>{trade.result}</span>
      <span className="text-zinc-400">{trade.note || "-"}</span>
      <button
        onClick={() => onDelete(trade.id)}
        className="text-zinc-500 hover:text-red-400 text-xl font-bold"
        title="삭제"
      >
        ×
      </button>
    </div>
  );
}

function Card({
  title,
  value,
  color = "text-white",
}: {
  title: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
      <p className="text-zinc-400">{title}</p>
      <h2 className={`text-3xl font-bold mt-2 ${color}`}>{value}</h2>
    </div>
  );
}