(() => {
  'use strict';

  const API_BASE_URL = 'https://repit-backend-prod-asia-northeast1.a.run.app';
  const FREE_BATCH_LIMIT = 20;
  const HISTORY_STORAGE_KEY = 'repit_verifier_history_v1';

  const FONT_SCALE_MAP = {
    normal: 16,
    large: 18.4,
    xlarge: 20.8,
  };

  const SAMPLE_MERCHANTS_REGISTRY = {
    T8010001032884: {
      t_number: 'T8010001032884',
      corporate_number: '8010001032884',
      legal_name: '株式会社セブン‐イレブン・ジャパン',
      legal_name_kana: 'カブシキガイシャセブンイレブンジャパン',
      trade_name: 'セブン-イレブン 芝公園店',
      kind: '1',
      address: '東京都千代田区二番町8番地8',
      post_code: '102-8455',
      registration_date: '2023-10-01',
      update_date: '2023-10-01',
      cancellation_date: null,
      expire_date: null,
    },
    T7010001008844: {
      t_number: 'T7010001008844',
      corporate_number: '7010001008844',
      legal_name: '株式会社ローソン',
      legal_name_kana: 'カブシキガイシャローソン',
      trade_name: 'ローソン 大崎店',
      kind: '1',
      address: '東京都品川区大崎一丁目11番2号',
      post_code: '141-8643',
      registration_date: '2023-10-01',
      update_date: '2023-10-05',
      cancellation_date: null,
      expire_date: null,
    },
    T4010001035544: {
      t_number: 'T4010001035544',
      corporate_number: '4010001035544',
      legal_name: 'アマゾンジャパン合同会社',
      legal_name_kana: 'アマゾンジャパンゴウドウガイシャ',
      trade_name: 'Amazon.co.jp',
      kind: '1',
      address: '東京都目黒区下目黒一丁目8番1号',
      post_code: '153-0064',
      registration_date: '2023-10-01',
      update_date: '2023-10-01',
      cancellation_date: null,
      expire_date: null,
    },
    T9810452109380: {
      t_number: 'T9810452109380',
      corporate_number: '9810452109380',
      legal_name: '佐藤 健一（個人事業主）',
      legal_name_kana: 'サトウ ケンイチ',
      trade_name: '珈琲館 銀座三丁目店',
      kind: '3',
      address: '東京都中央区銀座3-8-12',
      post_code: '104-0061',
      registration_date: '2023-10-01',
      update_date: '2023-10-01',
      cancellation_date: null,
      expire_date: null,
    },
    T5010002044816: {
      t_number: 'T5010002044816',
      corporate_number: '5010002044816',
      legal_name: '有限会社東京堂商事',
      legal_name_kana: 'ユウゲンガイシャトウキョウドウショウジ',
      trade_name: 'オフィスサプライ東京堂',
      kind: '1',
      address: '東京都千代田区神田錦町3-14',
      post_code: '101-0054',
      registration_date: '2023-10-01',
      update_date: '2026-10-01',
      cancellation_date: '2026-09-30',
      expire_date: null,
    },
  };

  const BATCH_PRESETS = {
    'mixed-real': {
      defaultDate: '2026-11-10',
      text: [
        'T8010001032884, 2026-11-10, セブン-イレブン 芝公園店, ¥1480',
        'T4010001035544, 2026-11-08, Amazon.co.jp備品, ¥18400',
        'T9810452109380, 2026-11-05, 珈琲館 銀座三丁目店, ¥1100',
        'T5010002044816, 2026-11-10, オフィスサプライ東京堂（9/30取消済）, ¥24200',
        'T1010001032884, 2026-11-10, OCR誤読サンプル（先頭桁タイポ）',
      ].join('\n'),
    },
    'email-extract': {
      defaultDate: '2026-11-10',
      text: [
        'いつもお世話になっております。10月分の御請求書を送付いたします。',
        '・請求日：令和8年10月15日',
        '・適格請求書発行事業者登録番号：Ｔ７０１０－００１０－０８８４４（株式会社ローソン）',
        '・御請求金額：¥12,500（税込）',
        '',
        'また、別件の事務用品（令和8年10月20日・¥8,400）は以下となります：',
        '有限会社東京堂商事 登録番号 T5010002044816',
      ].join('\n'),
    },
    'transitional-2026': {
      defaultDate: '2026-10-15',
      text: [
        'T5010002044816, 2026-09-25, 取消前（9/25取引→100%控除可）, ¥33000',
        'T5010002044816, 2026-09-30, 取消当日（9/30取引→80%経過措置）, ¥22000',
        'T5010002044816, 2026-10-05, 10月以降・1万円以上（→50%経過措置）, ¥15000',
        'T5010002044816, 2026-10-05, 10月以降・1万円未満（→少額特例候補100%）, ¥6800',
      ].join('\n'),
    },
  };

  function escapeHtml(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getTodayIsoJst() {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 10);
  }

  function toHalfWidthAscii(input) {
    return String(input || '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[／]/g, '/')
      .replace(/[－ー‐]/g, '-')
      .replace(/[，]/g, ',');
  }

  function normalizeTNumber(rawInput) {
    const halfWidth = String(rawInput || '')
      .replace(/[Ｔｔ]/g, 'T')
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[\s\-ー－‐]/g, '')
      .toUpperCase();

    if (halfWidth.startsWith('T')) return halfWidth;
    if (/^\d{13}$/.test(halfWidth)) return 'T' + halfWidth;
    return halfWidth;
  }

  function analyzeTNumberModulus9(rawInput) {
    const normalized = normalizeTNumber(rawInput);
    const digitsOnly = normalized.startsWith('T') ? normalized.slice(1) : normalized;

    if (!/^\d{13}$/.test(digitsOnly)) {
      return {
        normalized,
        digitsOnly,
        isValidFormat: false,
        isValidCheckDigit: false,
        expectedCheckDigit: null,
        actualCheckDigit: null,
        reasonJa: 'T＋13桁の半角数字（計14文字）で入力してください。',
        breakdown: [],
        weightedSum: null,
        remainder: null,
      };
    }

    const actualCheckDigit = Number(digitsOnly[0]);
    let weightedSum = 0;
    const breakdown = [];

    for (let idx = 0; idx < 13; idx++) {
      const digit = Number(digitsOnly[idx]);
      const positionFromRight = 13 - idx;
      if (idx === 0) {
        breakdown.push({
          positionFromLeft: 1,
          positionFromRight,
          digit,
          weight: null,
          product: null,
          isCheckDigit: true,
        });
      } else {
        const weight = positionFromRight % 2 === 1 ? 1 : 2;
        const product = digit * weight;
        weightedSum += product;
        breakdown.push({
          positionFromLeft: idx + 1,
          positionFromRight,
          digit,
          weight,
          product,
          isCheckDigit: false,
        });
      }
    }

    if (actualCheckDigit === 0) {
      return {
        normalized: 'T' + digitsOnly,
        digitsOnly,
        isValidFormat: true,
        isValidCheckDigit: false,
        expectedCheckDigit: null,
        actualCheckDigit: 0,
        reasonJa: '先頭の検査用数字（チェックデジット）に「0」は使用されません。',
        breakdown,
        weightedSum,
        remainder: weightedSum % 9,
      };
    }

    const remainder = weightedSum % 9;
    const expectedCheckDigit = 9 - remainder;
    const isValidCheckDigit = actualCheckDigit === expectedCheckDigit;

    return {
      normalized: 'T' + digitsOnly,
      digitsOnly,
      isValidFormat: true,
      isValidCheckDigit,
      expectedCheckDigit,
      actualCheckDigit,
      reasonJa: isValidCheckDigit
        ? 'Modulus 9 チェックデジット検証OK（国税庁規定の13桁アルゴリズム適合）'
        : `チェックデジット不一致（先頭桁は「${expectedCheckDigit}」である必要がありますが「${actualCheckDigit}」が入力されています）`,
      breakdown,
      weightedSum,
      remainder,
    };
  }

  function extractDateFromText(rawText) {
    const text = toHalfWidthAscii(rawText);
    const isoMatch = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]);
      const d = Number(isoMatch[3]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    const reiwaMatch = text.match(/(?:令和|R)\s*(元|\d{1,2})[年./-](\d{1,2})[月./-](\d{1,2})日?/i);
    if (reiwaMatch) {
      const rYear = reiwaMatch[1] === '元' ? 1 : Number(reiwaMatch[1]);
      const y = 2018 + rYear;
      const m = Number(reiwaMatch[2]);
      const d = Number(reiwaMatch[3]);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  }

  function extractAmountFromText(rawText) {
    const text = toHalfWidthAscii(rawText);
    const match = text.match(/[¥￥]\s*([0-9][0-9,]{0,9})/) || text.match(/([0-9][0-9,]{0,9})\s*円/);
    if (!match) return null;
    const n = Number(match[1].replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function splitCsvLine(line) {
    const res = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        res.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur);
    return res;
  }

  function parseVerifierBatchText(rawText, defaultTxDate, maxItems = FREE_BATCH_LIMIT) {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const allParsed = [];
    const seen = new Set();
    let duplicateCount = 0;
    const tRegex = /(?:[TtＴｔ][-\sー－‐]?(?:\d[-\sー－‐]?){10,15}\d|\b\d{13}\b)/g;

    lines.forEach((rawLine) => {
      const halfLine = toHalfWidthAscii(rawLine);
      tRegex.lastIndex = 0;
      if (/^(?:t番号|登録番号|t_number|番号|事業者名|取引先)/i.test(halfLine) && !tRegex.test(halfLine)) {
        return;
      }
      tRegex.lastIndex = 0;

      const columns = halfLine.includes('\t')
        ? halfLine.split('\t').map((c) => c.trim())
        : halfLine.includes(',')
        ? splitCsvLine(halfLine).map((c) => c.trim())
        : null;

      const matches = halfLine.match(tRegex);
      if (!matches || matches.length === 0) {
        if (!columns && /^[Tt]?\d{4,15}[A-Za-z]?$/.test(halfLine.replace(/[-\s]/g, ''))) {
          const normalized = normalizeTNumber(halfLine);
          const key = `${normalized}|${defaultTxDate}`;
          const isDup = seen.has(key);
          if (isDup) duplicateCount += 1;
          seen.add(key);
          allParsed.push({
            rowIndex: allParsed.length + 1,
            rawInput: halfLine,
            normalizedTNumber: normalized,
            transactionDate: defaultTxDate,
            memo: null,
            amountYen: null,
            isDuplicateInBatch: isDup,
          });
        }
        return;
      }

      const rowDate = extractDateFromText(halfLine) || defaultTxDate;
      const rowAmount = extractAmountFromText(halfLine);

      matches.forEach((token) => {
        const normalized = normalizeTNumber(token);
        const key = `${normalized}|${rowDate}`;
        const isDup = seen.has(key);
        if (isDup) duplicateCount += 1;
        seen.add(key);

        let memo = null;
        if (columns) {
          const nonMeta = columns.filter((col) => {
            if (!col) return false;
            if (col.includes(token.trim())) return false;
            if (extractDateFromText(col) && col.length <= 16) return false;
            if (/^[¥￥]?[0-9,]+円?$/.test(col)) return false;
            return true;
          });
          if (nonMeta.length > 0) memo = nonMeta.join(' / ');
        } else {
          const stripped = rawLine
            .replace(token, '')
            .replace(/(?:20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?|(?:令和|R)\s*(?:元|\d{1,2})[年./-]\d{1,2}[月./-]\d{1,2}日?)/gi, '')
            .replace(/[¥￥]\s*[0-9,]+|[0-9,]+\s*円/g, '')
            .replace(/^(?:登録番号|インボイス番号|事業者登録番号|番号)[:：\s]*/g, '')
            .replace(/[|,、\t]+/g, ' ')
            .trim();
          if (stripped.length >= 2 && stripped.length <= 60) memo = stripped;
        }

        allParsed.push({
          rowIndex: allParsed.length + 1,
          rawInput: token.trim(),
          normalizedTNumber: normalized,
          transactionDate: rowDate,
          memo,
          amountYen: rowAmount,
          isDuplicateInBatch: isDup,
        });
      });
    });

    const items = allParsed.slice(0, maxItems);
    return {
      items,
      duplicateCount,
      truncatedCount: Math.max(0, allParsed.length - items.length),
    };
  }

  function decodeCsvBytes(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return new TextDecoder('utf-8').decode(bytes.slice(3));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('shift_jis').decode(bytes);
    }
  }

  function evaluateTaxInsight(status, taxDeduction, transactionDate, amountYen) {
    if (status === 'INVALID_FORMAT') {
      return {
        deductionRatePercent: 0,
        badgeLabelJa: '番号エラー（要修正）',
        shortRuleJa: 'チェックデジット不一致',
        adviceJa: '13桁の数字または先頭桁の誤入力・OCR誤読の可能性があります。領収書の印字を再確認してください。',
        smallAmountExemptionEligible: false,
      };
    }

    if (status === 'VALID_ACTIVE' && taxDeduction === 'FULL_DEDUCTION') {
      return {
        deductionRatePercent: 100,
        badgeLabelJa: '100% 仕入税額控除可',
        shortRuleJa: '適格請求書（取引日時点有効）',
        adviceJa: '取引日時点で有効な適格請求書発行事業者です。標準10%・軽減8%ともに全額仕入税額控除の対象となります。',
        smallAmountExemptionEligible: false,
      };
    }

    const isPeriod = transactionDate >= '2023-10-01' && transactionDate <= '2029-09-30';
    const isUnder10k = amountYen !== null && amountYen < 10000;
    const smallAmountCandidate = isPeriod && isUnder10k;

    if (taxDeduction === 'TRANSITIONAL_80_PERCENT' || transactionDate <= '2026-09-30') {
      return {
        deductionRatePercent: smallAmountCandidate ? 100 : 80,
        badgeLabelJa: smallAmountCandidate ? '少額特例候補 (100%)' : '経過措置 80%控除',
        shortRuleJa: smallAmountCandidate
          ? '1万円未満少額特例（基準期間課税売上1億円以下等）'
          : '免税事業者経過措置（〜2026/09/30）',
        adviceJa: smallAmountCandidate
          ? `税込 ${amountYen.toLocaleString('ja-JP')}円（1万円未満）のため、要件（基準期間の課税売上高1億円以下等）を満たす事業者は帳簿保存のみで100%控除可能です。非該当の場合は経過措置80%控除となります。`
          : '取引日が2026年9月30日以前のため、区分記載請求書等と同等の記載・帳簿保存により消費税の80%を仕入税額控除できます。',
        smallAmountExemptionEligible: smallAmountCandidate,
      };
    }

    if (taxDeduction === 'TRANSITIONAL_50_PERCENT' || transactionDate <= '2029-09-30') {
      return {
        deductionRatePercent: smallAmountCandidate ? 100 : 50,
        badgeLabelJa: smallAmountCandidate ? '少額特例候補 (100%)' : '経過措置 50%控除',
        shortRuleJa: smallAmountCandidate
          ? '1万円未満少額特例（要件充足で100%控除）'
          : '2026年10月改正 50%経過措置',
        adviceJa: smallAmountCandidate
          ? `2026年10月以降は経過措置が50%へ縮小されましたが、税込 ${amountYen.toLocaleString('ja-JP')}円（1万円未満）のため少額特例の対象事業者は100%控除が可能です。`
          : '2026年10月1日以降の取引のため、経過措置による仕入税額控除率は50%に引き下げられています（※税込1万円未満かつ少額特例対象事業者の場合は100%可）。',
        smallAmountExemptionEligible: smallAmountCandidate,
      };
    }

    return {
      deductionRatePercent: 0,
      badgeLabelJa: '控除不可 (0%)',
      shortRuleJa: '経過措置期間終了（2029/10/01〜）',
      adviceJa: '経過措置期間終了後の取引となるため、適格請求書がない場合は原則として仕入税額控除を行えません。',
      smallAmountExemptionEligible: false,
    };
  }

  function resolveOfflineVerification(rawInput, transactionDate, memo = null) {
    const mod = analyzeTNumberModulus9(rawInput);
    if (!mod.isValidCheckDigit) {
      return {
        source: 'local-modulus9',
        apiResult: {
          t_number: mod.normalized || rawInput,
          is_valid_format: false,
          is_valid_on_transaction_date: false,
          status: 'INVALID_FORMAT',
          status_summary: '端末内 Modulus 9 ブロック：' + mod.reasonJa,
          tax_deduction: 'NONE',
          merchant: null,
          is_from_cache: false,
          query_latency_ms: 0.1,
        },
      };
    }

    const preset = SAMPLE_MERCHANTS_REGISTRY[mod.normalized];
    if (preset) {
      const getTransitional = (dt) => {
        if (dt <= '2026-09-30') return 'TRANSITIONAL_80_PERCENT';
        if (dt <= '2029-09-30') return 'TRANSITIONAL_50_PERCENT';
        return 'NONE';
      };

      let status = 'VALID_ACTIVE';
      let isValidOnTx = true;
      let taxDeduction = 'FULL_DEDUCTION';
      let summary = `適格請求書発行事業者・取引日（${transactionDate}）時点で有効`;

      if (preset.registration_date && transactionDate < preset.registration_date) {
        status = 'NOT_YET_REGISTERED';
        isValidOnTx = false;
        taxDeduction = getTransitional(transactionDate);
        summary = `取引日（${transactionDate}）時点で適格事業者として未登録（${preset.registration_date} 登録）`;
      } else if (preset.cancellation_date && transactionDate >= preset.cancellation_date) {
        status = 'CANCELLED_BEFORE_TX';
        isValidOnTx = false;
        taxDeduction = getTransitional(transactionDate);
        summary = `取引日（${transactionDate}）時点で登録取消済（${preset.cancellation_date} 取消処分）`;
      }

      return {
        source: 'local-sample',
        apiResult: {
          t_number: mod.normalized,
          is_valid_format: true,
          is_valid_on_transaction_date: isValidOnTx,
          status,
          status_summary: summary,
          tax_deduction: taxDeduction,
          merchant: Object.assign({}, preset, { trade_name: memo || preset.trade_name }),
          is_from_cache: false,
          query_latency_ms: 0.2,
        },
      };
    }

    return {
      source: 'local-modulus9',
      apiResult: {
        t_number: mod.normalized,
        is_valid_format: true,
        is_valid_on_transaction_date: true,
        status: 'VALID_ACTIVE',
        status_summary:
          'Modulus 9 チェックデジット適合（現在オフライン／API未接続モードのため形式検証のみ完了・下の国税庁公式リンクで商号を直接照会できます）',
        tax_deduction: 'FULL_DEDUCTION',
        merchant: null,
        is_from_cache: false,
        query_latency_ms: 0.1,
      },
    };
  }

  function getNtaOfficialUrl(normalizedT) {
    const digits = String(normalizedT || '').replace(/^T/i, '');
    if (!/^\d{13}$/.test(digits)) return null;
    return `https://www.invoice-kohyo.nta.go.jp/regno-search/detail?selRegNo=${digits}`;
  }

  function formatIssuerKindJa(kind) {
    if (kind === '1') return '法人';
    if (kind === '2') return '人格のない社団等';
    if (kind === '3') return '個人事業主';
    return '事業者';
  }

  async function fetchWithTimeout(url, init, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  async function executeSingleVerification(rawInput, transactionDate, amountYen) {
    const mod = analyzeTNumberModulus9(rawInput);
    if (!mod.isValidCheckDigit) {
      const off = resolveOfflineVerification(rawInput, transactionDate);
      return {
        id: `single-${Date.now()}`,
        rowIndex: 1,
        rawInput,
        normalizedTNumber: mod.normalized || rawInput,
        transactionDate,
        memo: null,
        amountYen,
        isDuplicateInBatch: false,
        modulus9: mod,
        apiResult: off.apiResult,
        taxInsight: evaluateTaxInsight(off.apiResult.status, off.apiResult.tax_deduction, transactionDate, amountYen),
        source: off.source,
        ntaOfficialUrl: null,
      };
    }

    try {
      const qs = new URLSearchParams();
      if (transactionDate) qs.set('transaction_date', transactionDate);
      const resp = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/invoice/${encodeURIComponent(mod.normalized)}?${qs.toString()}`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        4500
      );
      if (!resp.ok) throw new Error('API Error');
      const apiResult = await resp.json();
      return {
        id: `single-${Date.now()}`,
        rowIndex: 1,
        rawInput,
        normalizedTNumber: apiResult.t_number,
        transactionDate,
        memo: null,
        amountYen,
        isDuplicateInBatch: false,
        modulus9: mod,
        apiResult,
        taxInsight: evaluateTaxInsight(apiResult.status, apiResult.tax_deduction, transactionDate, amountYen),
        source: apiResult.is_from_cache ? 'api-cache' : 'api-live',
        ntaOfficialUrl: getNtaOfficialUrl(apiResult.t_number),
      };
    } catch {
      const off = resolveOfflineVerification(rawInput, transactionDate);
      return {
        id: `single-${Date.now()}`,
        rowIndex: 1,
        rawInput,
        normalizedTNumber: off.apiResult.t_number,
        transactionDate,
        memo: null,
        amountYen,
        isDuplicateInBatch: false,
        modulus9: mod,
        apiResult: off.apiResult,
        taxInsight: evaluateTaxInsight(off.apiResult.status, off.apiResult.tax_deduction, transactionDate, amountYen),
        source: off.source,
        ntaOfficialUrl: getNtaOfficialUrl(off.apiResult.t_number),
      };
    }
  }

  async function executeBatchVerification(items) {
    const t0 = performance.now();
    const byDate = new Map();
    items.forEach((it) => {
      const arr = byDate.get(it.transactionDate) || [];
      arr.push(it);
      byDate.set(it.transactionDate, arr);
    });

    const resolvedMap = new Map();
    let usedFallback = false;
    let totalCacheHits = 0;

    await Promise.all(
      Array.from(byDate.entries()).map(async ([txDate, group]) => {
        try {
          const resp = await fetchWithTimeout(
            `${API_BASE_URL}/api/v1/invoice/batch-verify`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                numbers: group.map((g) => g.normalizedTNumber),
                transaction_date: txDate,
              }),
            },
            6000
          );
          if (!resp.ok) throw new Error('Batch API Error');
          const batchResp = await resp.json();
          totalCacheHits += batchResp.cache_hit_count || 0;

          group.forEach((item, idx) => {
            const mod = analyzeTNumberModulus9(item.rawInput);
            const apiRes = batchResp.results && batchResp.results[idx];
            if (!apiRes) {
              const off = resolveOfflineVerification(item.rawInput, txDate, item.memo);
              resolvedMap.set(item.rowIndex, buildEntry(item, mod, off.apiResult, off.source));
              return;
            }
            const src = apiRes.is_from_cache ? 'api-cache' : 'api-live';
            resolvedMap.set(item.rowIndex, buildEntry(item, mod, apiRes, src));
          });
        } catch {
          usedFallback = true;
          group.forEach((item) => {
            const mod = analyzeTNumberModulus9(item.rawInput);
            const off = resolveOfflineVerification(item.rawInput, txDate, item.memo);
            resolvedMap.set(item.rowIndex, buildEntry(item, mod, off.apiResult, off.source));
          });
        }
      })
    );

    const entries = items.map((i) => resolvedMap.get(i.rowIndex)).filter(Boolean);
    let validCount = 0;
    let warningCount = 0;
    let formatErrorCount = 0;

    entries.forEach((e) => {
      if (e.apiResult.status === 'INVALID_FORMAT') formatErrorCount += 1;
      else if (e.apiResult.is_valid_on_transaction_date) validCount += 1;
      else warningCount += 1;
    });

    return {
      entries,
      stats: {
        totalCount: entries.length,
        validCount,
        warningCount,
        formatErrorCount,
        cacheHitCount: totalCacheHits,
        totalDurationMs: Math.max(0.1, Number((performance.now() - t0).toFixed(1))),
        usedFallback,
      },
    };
  }

  function buildEntry(item, mod, apiResult, source) {
    return {
      id: `row-${item.rowIndex}-${apiResult.t_number}`,
      rowIndex: item.rowIndex,
      rawInput: item.rawInput,
      normalizedTNumber: apiResult.t_number,
      transactionDate: item.transactionDate,
      memo: item.memo,
      amountYen: item.amountYen,
      isDuplicateInBatch: item.isDuplicateInBatch,
      modulus9: mod,
      apiResult,
      taxInsight: evaluateTaxInsight(apiResult.status, apiResult.tax_deduction, item.transactionDate, item.amountYen),
      source,
      ntaOfficialUrl: apiResult.is_valid_format ? getNtaOfficialUrl(apiResult.t_number) : null,
    };
  }

  function escapeCsvCell(val) {
    const raw = val === null || val === undefined ? '' : String(val);
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  function buildVerifierCsv(entries) {
    const headers = [
      '行番号',
      '入力値',
      '正規化T番号',
      '取引年月日',
      '取引日時点判定',
      'ステータス',
      '仕入税額控除区分',
      '控除率(%)',
      '国税庁公表商号',
      '屋号・メモ',
      '事業者区分',
      '所在地',
      '登録年月日',
      '取消・失効年月日',
      '金額(税込)',
      '検証ソース',
      '判定解説',
    ];
    const rows = entries.map((e) => {
      const m = e.apiResult.merchant;
      const verdict =
        e.apiResult.status === 'INVALID_FORMAT'
          ? '形式エラー'
          : e.apiResult.is_valid_on_transaction_date
          ? '有効（適格）'
          : '要注意（無効・経過措置）';
      return [
        e.rowIndex,
        e.rawInput,
        e.normalizedTNumber,
        e.transactionDate,
        verdict,
        e.apiResult.status,
        e.taxInsight.badgeLabelJa,
        e.taxInsight.deductionRatePercent,
        m?.legal_name || '',
        e.memo || m?.trade_name || '',
        m ? formatIssuerKindJa(m.kind) : '',
        m?.address || '',
        m?.registration_date || '',
        m?.cancellation_date || m?.expire_date || '',
        e.amountYen ?? '',
        e.source === 'api-cache' || e.source === 'api-live'
          ? '国税庁APIプロキシ'
          : e.source === 'local-sample'
          ? 'サンプル台帳'
          : '端末内Modulus9検査',
        e.apiResult.status_summary,
      ]
        .map(escapeCsvCell)
        .join(',');
    });
    return `\uFEFF${headers.map(escapeCsvCell).join(',')}\r\n${rows.join('\r\n')}`;
  }

  function buildVerifierTsv(entries) {
    const headers = ['T番号', '取引日', '判定', '控除率', '公表商号', '屋号・メモ', '所在地', '判定詳細'];
    const sanitize = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ');
    const rows = entries.map((e) => {
      const m = e.apiResult.merchant;
      const verdict =
        e.apiResult.status === 'INVALID_FORMAT'
          ? '形式エラー'
          : e.apiResult.is_valid_on_transaction_date
          ? '有効'
          : '要注意';
      return [
        e.normalizedTNumber,
        e.transactionDate,
        verdict,
        `${e.taxInsight.deductionRatePercent}%`,
        m?.legal_name || '（未取得）',
        e.memo || m?.trade_name || '',
        m?.address || '',
        e.apiResult.status_summary,
      ]
        .map(sanitize)
        .join('\t');
    });
    return `${headers.join('\t')}\n${rows.join('\n')}`;
  }

  // ============================================================================
  // DOM Controllers & UI Rendering
  // ============================================================================
  const rootEl = document.getElementById('repitVerifierRoot');
  const srAnnouncer = document.getElementById('srAnnouncer');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const fontBtns = document.querySelectorAll('.font-btn');

  let currentTheme = 'light';
  let currentMode = 'single';
  let showDigitBreakdown = false;
  let lastSingleEntry = null;
  let batchEntries = [];
  let batchStats = null;
  let resultFilter = 'all';
  let resultSearch = '';
  let expandedRowId = null;

  function announce(msg) {
    if (srAnnouncer) srAnnouncer.textContent = msg;
  }

  // Theme & Font Scale
  themeToggleBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.className = `theme-${currentTheme}`;
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.body.className = `theme-${currentTheme}`;
    rootEl.className = `repit-lp-root theme-${currentTheme}`;
    themeToggleBtn.textContent = currentTheme === 'light' ? '🌙 藍墨ダーク' : '☀️ 和紙ライト';
  });

  fontBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const scale = btn.dataset.scale;
      const px = FONT_SCALE_MAP[scale] || 16;
      document.documentElement.style.fontSize = `${px}px`;
      document.documentElement.setAttribute('data-font-scale', scale);
      rootEl.style.fontSize = `${px}px`;
      fontBtns.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    });
  });

  // Mode Tabs
  const tabSingle = document.getElementById('tab-single');
  const tabBatch = document.getElementById('tab-batch');
  const panelSingle = document.getElementById('panel-single');
  const panelBatch = document.getElementById('panel-batch');
  const modeTabList = document.getElementById('modeTabList');

  function setMode(nextMode) {
    currentMode = nextMode;
    const isSingle = nextMode === 'single';
    tabSingle.classList.toggle('active', isSingle);
    tabBatch.classList.toggle('active', !isSingle);
    tabSingle.setAttribute('aria-selected', String(isSingle));
    tabBatch.setAttribute('aria-selected', String(!isSingle));
    panelSingle.hidden = !isSingle;
    panelBatch.hidden = isSingle;
    panelSingle.style.display = isSingle ? '' : 'none';
    panelBatch.style.display = isSingle ? 'none' : '';
    panelSingle.setAttribute('aria-hidden', String(!isSingle));
    panelBatch.setAttribute('aria-hidden', String(isSingle));
    announce(
      isSingle
        ? '単一ナンバー瞬時確認モードに切り替えました。'
        : '一括貼り付け・CSV確認モードに切り替えました。'
    );
  }

  tabSingle.addEventListener('click', () => setMode('single'));
  tabBatch.addEventListener('click', () => setMode('batch'));
  modeTabList.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setMode(currentMode === 'single' ? 'batch' : 'single');
    }
  });

  // History
  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  function pushHistory(entry) {
    if (!entry.apiResult.is_valid_format) return;
    const prev = loadHistory();
    const item = {
      tNumber: entry.normalizedTNumber,
      transactionDate: entry.transactionDate,
      isValidOnDate: entry.apiResult.is_valid_on_transaction_date,
    };
    const next = [
      item,
      ...prev.filter((p) => p.tNumber !== item.tNumber || p.transactionDate !== item.transactionDate),
    ].slice(0, 10);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    renderHistory();
  }

  function renderHistory() {
    const strip = document.getElementById('historyStrip');
    const row = document.getElementById('historyChipsRow');
    const items = loadHistory();
    if (items.length === 0) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    row.innerHTML = items
      .map(
        (it) => `
      <button type="button" class="history-chip tnum" data-hist-t="${escapeHtml(it.tNumber)}" data-hist-date="${escapeHtml(it.transactionDate)}">
        <span class="${it.isValidOnDate ? 'dot-valid' : 'dot-warn'}"></span>
        <span>${escapeHtml(it.tNumber)}</span>
        <small>${escapeHtml(it.transactionDate)}</small>
      </button>`
      )
      .join('');
    row.querySelectorAll('.history-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        setMode('single');
        singleTInput.value = btn.dataset.histT;
        singleDateInput.value = btn.dataset.histDate;
        updateSingleMicrostatus();
        void runSingleVerify(false);
      });
    });
  }

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // ignore
    }
    renderHistory();
    announce('確認履歴をクリアしました。');
  });

  // Single Mode Controls
  const singleTInput = document.getElementById('singleTInput');
  const singleDateInput = document.getElementById('singleDateInput');
  const singleAmountInput = document.getElementById('singleAmountInput');
  const singleLiveMicrostatus = document.getElementById('singleLiveMicrostatus');
  const singleResultContainer = document.getElementById('singleResultContainer');
  const singleSubmitBtn = document.getElementById('singleSubmitBtn');

  function updateSingleMicrostatus() {
    const raw = singleTInput.value.trim();
    if (!raw) {
      singleLiveMicrostatus.innerHTML =
        '<span class="micro-muted">13桁の番号を入力すると0.1msでチェックデジットを検査します</span>';
      return;
    }
    const mod = analyzeTNumberModulus9(raw);
    if (mod.isValidCheckDigit) {
      singleLiveMicrostatus.innerHTML = `<span class="micro-valid">✓ 0.1ms 形式・Modulus 9 合格（正規化: ${escapeHtml(mod.normalized)}）</span>`;
    } else {
      singleLiveMicrostatus.innerHTML = `<span class="micro-error">✕ ${escapeHtml(mod.reasonJa)}</span>`;
    }
  }

  singleTInput.addEventListener('input', updateSingleMicrostatus);

  document.getElementById('singleClearBtn').addEventListener('click', () => {
    singleTInput.value = '';
    updateSingleMicrostatus();
    singleTInput.focus();
  });

  document.getElementById('singlePasteBtn').addEventListener('click', async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt && txt.trim()) {
        singleTInput.value = txt.trim();
        updateSingleMicrostatus();
        await runSingleVerify(true);
      }
    } catch {
      announce('クリップボードの読み取り権限がありません。直接入力してください。');
    }
  });

  document.getElementById('quickDateToday').addEventListener('click', () => {
    singleDateInput.value = getTodayIsoJst();
  });

  document.querySelectorAll('[data-quick-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      singleDateInput.value = btn.dataset.quickDate;
    });
  });

  document.querySelectorAll('#singlePresetBar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      singleTInput.value = btn.dataset.t;
      singleDateInput.value = btn.dataset.date;
      singleAmountInput.value = btn.dataset.amt || '';
      updateSingleMicrostatus();
      void runSingleVerify(true);
    });
  });

  document.getElementById('singleVerifyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    void runSingleVerify(true);
  });

  async function runSingleVerify(recordHistory = true) {
    const raw = singleTInput.value.trim();
    const txDate = singleDateInput.value || getTodayIsoJst();
    const amtRaw = singleAmountInput.value.trim();
    const amt = amtRaw ? Number(amtRaw) : null;
    const validAmt = amt !== null && Number.isFinite(amt) && amt > 0 ? amt : null;
    if (!raw) return;

    singleSubmitBtn.disabled = true;
    singleSubmitBtn.querySelector('span').textContent = '照合中...';
    try {
      const res = await executeSingleVerification(raw, txDate, validAmt);
      lastSingleEntry = res;
      renderSingleResult(res);
      if (recordHistory) pushHistory(res);
      announce(`${res.normalizedTNumber} の検証が完了しました。${res.taxInsight.badgeLabelJa}`);
    } finally {
      singleSubmitBtn.disabled = false;
      singleSubmitBtn.querySelector('span').textContent = '🔍 取引日時点で照合する';
    }
  }

  function renderSingleResult(entry) {
    const { apiResult, modulus9, taxInsight, source, ntaOfficialUrl } = entry;
    const isErr = apiResult.status === 'INVALID_FORMAT';
    const isValid = !isErr && apiResult.is_valid_on_transaction_date;
    const merchant = apiResult.merchant;
    const bannerClass = isErr ? 'banner-error' : isValid ? 'banner-valid' : 'banner-warning';
    const icon = isErr ? '✕' : isValid ? '✓' : '⚠️';

    const latencyLabel =
      source === 'api-cache'
        ? `⚡ DBキャッシュ (${apiResult.query_latency_ms}ms)`
        : source === 'api-live'
        ? `🏛️ 国税庁APIプロキシ (${apiResult.query_latency_ms}ms)`
        : source === 'local-sample'
        ? `⚡ サンプル台帳照合 (${apiResult.query_latency_ms}ms)`
        : `⚡ 端末内 Modulus 9 (${apiResult.query_latency_ms}ms)`;

    const merchantHtml = merchant
      ? `<dl class="merchant-dl tnum">
          <div class="merchant-dl-row">
            <dt>公表商号 / 氏名</dt>
            <dd class="merchant-legal-name">${escapeHtml(merchant.legal_name)}${
          merchant.legal_name_kana ? `<span class="merchant-kana">${escapeHtml(merchant.legal_name_kana)}</span>` : ''
        }</dd>
          </div>
          <div class="merchant-dl-row"><dt>事業者区分</dt><dd>${escapeHtml(formatIssuerKindJa(merchant.kind))}</dd></div>
          <div class="merchant-dl-row"><dt>登録番号 / 法人番号</dt><dd><code>${escapeHtml(merchant.t_number)}</code>（法人番号: <code>${escapeHtml(merchant.corporate_number)}</code>）</dd></div>
          ${merchant.trade_name ? `<div class="merchant-dl-row"><dt>屋号・店舗名</dt><dd>${escapeHtml(merchant.trade_name)}</dd></div>` : ''}
          <div class="merchant-dl-row"><dt>本店・主たる所在地</dt><dd>${merchant.post_code ? `〒${escapeHtml(merchant.post_code)} ` : ''}${escapeHtml(merchant.address || '公表情報なし')}</dd></div>
        </dl>`
      : `<div class="merchant-empty-state"><p>${
          isErr
            ? `チェックデジットが一致しないため、国税庁への照会を行わずに端末内で即時ブロックしました。${
                modulus9.expectedCheckDigit !== null
                  ? `<strong> 残り12桁から計算される正しい先頭桁は「${modulus9.expectedCheckDigit}」です。</strong>`
                  : ''
              }`
            : '現在オフライン／API未接続モードのため、13桁 Modulus 9 チェックデジット検証のみ完了しています。上の「国税庁公表サイトで原本を開く」リンクから最新公表情報を直接確認できます。'
        }</p></div>`;

    const insightClass =
      taxInsight.deductionRatePercent === 100
        ? 'insight-emerald'
        : taxInsight.deductionRatePercent >= 50
        ? 'insight-amber'
        : 'insight-red';

    const digitStripHtml = modulus9.isValidFormat
      ? `<div class="modulus-digits-strip tnum" aria-label="13桁チェックデジット可視化">
          <span class="digit-prefix">T</span>
          ${modulus9.breakdown
            .map(
              (cell) => `<div class="digit-cell ${
                cell.isCheckDigit ? (modulus9.isValidCheckDigit ? 'cell-check-ok' : 'cell-check-err') : ''
              }" title="${
                cell.isCheckDigit
                  ? `先頭検査桁 C1（期待値: ${modulus9.expectedCheckDigit}）`
                  : `右から${cell.positionFromRight}桁目: ${cell.digit} × 重み${cell.weight} = ${cell.product}`
              }"><strong>${cell.digit}</strong><small>${cell.isCheckDigit ? 'C1' : `×${cell.weight}`}</small></div>`
            )
            .join('')}
        </div>
        ${
          showDigitBreakdown && modulus9.weightedSum !== null
            ? `<div class="modulus-formula-box tnum">
                <p>右から奇数桁×1・偶数桁×2 の加重和 = <strong>${modulus9.weightedSum}</strong></p>
                <p>検査用数字 C1 = 9 - (${modulus9.weightedSum} mod 9 = ${modulus9.remainder}) = <strong>${modulus9.expectedCheckDigit}</strong> （入力先頭桁: <strong>${modulus9.actualCheckDigit}</strong>）</p>
              </div>`
            : ''
        }`
      : '<p class="modulus-format-hint">Tを除いた13桁の半角数字が揃うと、チェックデジット（C1）の視覚分解が表示されます。</p>';

    singleResultContainer.innerHTML = `
      <div class="verifier-result-banner ${bannerClass}">
        <div class="verdict-banner-top">
          <div class="verdict-title-group">
            <span>${icon}</span>
            <span class="verifier-result-title">${escapeHtml(apiResult.status_summary)}</span>
          </div>
          <span class="verdict-latency-pill tnum">${escapeHtml(latencyLabel)}</span>
        </div>
        <div class="verdict-quick-actions tnum">
          <button type="button" id="copySingleTBtn" class="verdict-copy-btn">📋 T番号コピー (${escapeHtml(entry.normalizedTNumber)})</button>
          ${merchant?.legal_name ? '<button type="button" id="copySingleNameBtn" class="verdict-copy-btn">📋 商号コピー</button>' : ''}
          ${
            ntaOfficialUrl
              ? `<a href="${escapeHtml(ntaOfficialUrl)}" target="_blank" rel="noopener noreferrer" class="verdict-nta-btn">国税庁公表サイトで原本を開く ↗</a>`
              : ''
          }
        </div>
      </div>

      <div class="single-detail-grid">
        <div class="single-detail-card">
          <h3>国税庁 公表事業者情報 &amp; 時点タイムライン</h3>
          ${merchantHtml}
          <div class="pit-timeline-box tnum">
            <span class="pit-timeline-label">取引日時点（Point-in-Time）タイムライン比較</span>
            <div class="pit-nodes-row">
              <div class="pit-node"><small>登録年月日</small><strong>${escapeHtml(merchant?.registration_date || '2023-10-01（推定）')}</strong></div>
              <div class="pit-connector" aria-hidden="true"></div>
              <div class="pit-node ${isValid ? 'node-valid' : 'node-warn'}"><small>今回の取引日 ★</small><strong>${escapeHtml(entry.transactionDate)}</strong></div>
              <div class="pit-connector" aria-hidden="true"></div>
              <div class="pit-node ${merchant?.cancellation_date || merchant?.expire_date ? 'node-danger' : ''}"><small>取消・失効日</small><strong>${escapeHtml(merchant?.cancellation_date || merchant?.expire_date || 'なし（継続中）')}</strong></div>
            </div>
          </div>
        </div>

        <div class="single-detail-card">
          <h3>2026年10月改正・仕入税額控除判定</h3>
          <div class="tax-insight-box ${insightClass}">
            <div class="tax-insight-head tnum">
              <span class="tax-rate-big">${taxInsight.deductionRatePercent}%</span>
              <div><strong>${escapeHtml(taxInsight.badgeLabelJa)}</strong><small>${escapeHtml(taxInsight.shortRuleJa)}</small></div>
            </div>
            <p class="tax-insight-advice">${escapeHtml(taxInsight.adviceJa)}</p>
            ${
              entry.amountYen !== null
                ? `<div class="tax-insight-amount tnum">入力税込金額: ¥${entry.amountYen.toLocaleString('ja-JP')}（${
                    entry.amountYen < 10000 ? '1万円未満・少額特例ライン内' : '1万円以上'
                  }）</div>`
                : ''
            }
          </div>

          <div class="modulus-inspector-box">
            <div class="modulus-inspector-header">
              <span>Modulus 9 チェックデジット 13桁構造</span>
              <button type="button" id="toggleModulusBtn" class="modulus-toggle-btn">${showDigitBreakdown ? '計算式を隠す' : '13桁の計算式を見る'}</button>
            </div>
            ${digitStripHtml}
          </div>
        </div>
      </div>
    `;

    const copyTBtn = document.getElementById('copySingleTBtn');
    if (copyTBtn) {
      copyTBtn.addEventListener('click', () => {
        void copyToClipboard(entry.normalizedTNumber, copyTBtn, `📋 T番号コピー (${entry.normalizedTNumber})`, 'T番号');
      });
    }
    const copyNameBtn = document.getElementById('copySingleNameBtn');
    if (copyNameBtn && merchant?.legal_name) {
      copyNameBtn.addEventListener('click', () => {
        void copyToClipboard(merchant.legal_name, copyNameBtn, '📋 商号コピー', '公表商号');
      });
    }
    const toggleModBtn = document.getElementById('toggleModulusBtn');
    if (toggleModBtn) {
      toggleModBtn.addEventListener('click', () => {
        showDigitBreakdown = !showDigitBreakdown;
        if (lastSingleEntry) renderSingleResult(lastSingleEntry);
      });
    }
  }

  async function copyToClipboard(text, btn, defaultLabel, labelJa) {
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ コピー済';
      announce(`${labelJa}をクリップボードにコピーしました。`);
      setTimeout(() => {
        btn.textContent = defaultLabel;
      }, 1800);
    } catch {
      announce('クリップボードへのコピーに失敗しました。');
    }
  }

  // Batch Mode Controls
  const batchTextarea = document.getElementById('batchTextarea');
  const batchDefaultDate = document.getElementById('batchDefaultDate');
  const batchPrecheckStats = document.getElementById('batchPrecheckStats');
  const batchRunBtn = document.getElementById('batchRunBtn');
  const batchResultsContainer = document.getElementById('batchResultsContainer');
  const batchDropWrapper = document.getElementById('batchDropWrapper');
  const batchCsvFileInput = document.getElementById('batchCsvFileInput');
  const uploadedFileBadge = document.getElementById('uploadedFileBadge');

  batchTextarea.value = BATCH_PRESETS['mixed-real'].text;

  function updateBatchPrecheck() {
    const parsed = parseVerifierBatchText(batchTextarea.value, batchDefaultDate.value || getTodayIsoJst(), FREE_BATCH_LIMIT);
    const badges = [
      `<span class="pill-badge pill-blue">自動抽出: ${parsed.items.length} / ${FREE_BATCH_LIMIT} 件（無料枠）</span>`,
    ];
    if (parsed.duplicateCount > 0) {
      badges.push(`<span class="pill-badge pill-amber">同一T番号・同日重複: ${parsed.duplicateCount}件</span>`);
    }
    if (parsed.truncatedCount > 0) {
      badges.push(`<span class="pill-badge pill-red">超過 ${parsed.truncatedCount}件（Proプランで1,000件一括対応）</span>`);
    }
    batchPrecheckStats.innerHTML = badges.join('');
    batchRunBtn.disabled = parsed.items.length === 0;
    batchRunBtn.querySelector('span').textContent = `✨ ${parsed.items.length}件を一括検証する`;
    return parsed;
  }

  batchTextarea.addEventListener('input', updateBatchPrecheck);
  batchDefaultDate.addEventListener('change', updateBatchPrecheck);

  document.querySelectorAll('#batchPresetBar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = BATCH_PRESETS[btn.dataset.batchPreset];
      if (!preset) return;
      batchTextarea.value = preset.text;
      batchDefaultDate.value = preset.defaultDate;
      uploadedFileBadge.hidden = true;
      updateBatchPrecheck();
    });
  });

  document.getElementById('batchClearBtn').addEventListener('click', () => {
    batchTextarea.value = '';
    uploadedFileBadge.hidden = true;
    updateBatchPrecheck();
  });

  document.getElementById('batchUploadBtn').addEventListener('click', () => batchCsvFileInput.click());
  batchCsvFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    batchTextarea.value = decodeCsvBytes(buf);
    uploadedFileBadge.textContent = `📄 ${file.name}`;
    uploadedFileBadge.hidden = false;
    updateBatchPrecheck();
  });

  batchDropWrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    batchDropWrapper.classList.add('is-dragging');
  });
  batchDropWrapper.addEventListener('dragleave', () => batchDropWrapper.classList.remove('is-dragging'));
  batchDropWrapper.addEventListener('drop', async (e) => {
    e.preventDefault();
    batchDropWrapper.classList.remove('is-dragging');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    batchTextarea.value = decodeCsvBytes(buf);
    uploadedFileBadge.textContent = `📄 ${file.name}`;
    uploadedFileBadge.hidden = false;
    updateBatchPrecheck();
  });

  batchRunBtn.addEventListener('click', async () => {
    const parsed = updateBatchPrecheck();
    if (parsed.items.length === 0) return;

    batchRunBtn.disabled = true;
    batchRunBtn.querySelector('span').textContent = '一括検証中...';
    try {
      const result = await executeBatchVerification(parsed.items);
      batchEntries = result.entries;
      batchStats = result.stats;
      resultFilter = 'all';
      resultSearch = '';
      expandedRowId = null;
      renderBatchResults();
      announce(
        `${batchStats.totalCount}件の一括検証が完了しました。有効 ${batchStats.validCount}件、要注意 ${batchStats.warningCount}件、形式エラー ${batchStats.formatErrorCount}件。`
      );
    } finally {
      batchRunBtn.disabled = false;
      updateBatchPrecheck();
    }
  });

  function getFilteredBatchEntries() {
    const q = resultSearch.trim().toLowerCase();
    return batchEntries.filter((e) => {
      const isErr = e.apiResult.status === 'INVALID_FORMAT';
      const isValid = !isErr && e.apiResult.is_valid_on_transaction_date;
      const isWarn = !isErr && !isValid;
      if (resultFilter === 'valid' && !isValid) return false;
      if (resultFilter === 'warning' && !isWarn) return false;
      if (resultFilter === 'error' && !isErr) return false;
      if (!q) return true;
      const hay = [
        e.normalizedTNumber,
        e.rawInput,
        e.apiResult.merchant?.legal_name,
        e.apiResult.merchant?.trade_name,
        e.apiResult.merchant?.address,
        e.memo,
        e.apiResult.status_summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderBatchResults() {
    if (!batchStats) {
      batchResultsContainer.hidden = true;
      return;
    }
    batchResultsContainer.hidden = false;

    const filtered = getFilteredBatchEntries();
    const rowsHtml =
      filtered.length === 0
        ? '<tr><td colspan="7" class="batch-empty-cell">該当する検証結果はありません。検索条件を変更してください。</td></tr>'
        : filtered
            .map((e) => {
              const isErr = e.apiResult.status === 'INVALID_FORMAT';
              const isValid = !isErr && e.apiResult.is_valid_on_transaction_date;
              const isExpanded = expandedRowId === e.id;
              const m = e.apiResult.merchant;

              const statusLabel = isErr
                ? '✕ 形式エラー'
                : isValid
                ? '✓ 有効（適格）'
                : e.apiResult.status === 'CANCELLED_BEFORE_TX'
                ? '⚠️ 取消済'
                : e.apiResult.status === 'NOT_YET_REGISTERED'
                ? '⚠️ 登録前'
                : e.apiResult.status === 'EXPIRED_BEFORE_TX'
                ? '⚠️ 失効済'
                : '⚠️ 未登録';

              const pillClass = isErr ? 'pill-status-error' : isValid ? 'pill-status-valid' : 'pill-status-warning';

              const mainRow = `<tr class="batch-row">
                <td class="tnum">${e.rowIndex}</td>
                <td class="tnum"><div class="cell-tnumber"><code>${escapeHtml(e.normalizedTNumber)}</code>${
                e.isDuplicateInBatch ? '<span class="dup-chip">重複</span>' : ''
              }</div></td>
                <td class="tnum">${escapeHtml(e.transactionDate)}</td>
                <td><span class="status-pill ${pillClass}">${statusLabel}</span></td>
                <td class="tnum"><div class="cell-tax-insight"><strong>${escapeHtml(e.taxInsight.badgeLabelJa)}</strong>${
                e.amountYen !== null ? `<small>¥${e.amountYen.toLocaleString('ja-JP')}</small>` : ''
              }</div></td>
                <td><div class="cell-merchant"><strong>${escapeHtml(
                  m?.legal_name || (isErr ? 'チェックデジット不一致' : '（API接続時に商号取得）')
                )}</strong>${e.memo ? `<small>${escapeHtml(e.memo)}</small>` : ''}</div></td>
                <td><div class="cell-actions">
                  <button type="button" class="row-detail-btn" data-expand-id="${escapeHtml(e.id)}" aria-expanded="${isExpanded}">${
                isExpanded ? '閉じる' : '詳細'
              }</button>
                  ${
                    e.ntaOfficialUrl
                      ? `<a href="${escapeHtml(e.ntaOfficialUrl)}" target="_blank" rel="noopener noreferrer" class="row-nta-link">国税庁 ↗</a>`
                      : ''
                  }
                </div></td>
              </tr>`;

              const expandedRow = isExpanded
                ? `<tr class="batch-expanded-row"><td colspan="7"><div class="expanded-detail-box">
                    <p><strong>判定理由：</strong>${escapeHtml(e.apiResult.status_summary)}</p>
                    <p><strong>税務実務ガイド：</strong>${escapeHtml(e.taxInsight.adviceJa)}</p>
                    ${
                      m
                        ? `<div class="expanded-meta-grid tnum">
                            <span>区分: ${escapeHtml(formatIssuerKindJa(m.kind))}</span>
                            <span>所在地: ${m.post_code ? `〒${escapeHtml(m.post_code)} ` : ''}${escapeHtml(m.address || '—')}</span>
                            <span>登録日: ${escapeHtml(m.registration_date || '—')}</span>
                            <span>取消/失効日: ${escapeHtml(m.cancellation_date || m.expire_date || 'なし')}</span>
                          </div>`
                        : ''
                    }
                  </div></td></tr>`
                : '';

              return mainRow + expandedRow;
            })
            .join('');

    batchResultsContainer.innerHTML = `
      <div class="batch-kpi-grid tnum">
        <div class="batch-kpi-card"><span class="kpi-label">照合件数</span><strong class="kpi-val">${batchStats.totalCount}件</strong><span class="kpi-sub">所要時間 ${batchStats.totalDurationMs} ms</span></div>
        <div class="batch-kpi-card kpi-emerald"><span class="kpi-label">適格（100%控除可）</span><strong class="kpi-val">${batchStats.validCount}件</strong><span class="kpi-sub">取引日時点で登録有効</span></div>
        <div class="batch-kpi-card kpi-amber"><span class="kpi-label">要注意（取消・未登録等）</span><strong class="kpi-val">${batchStats.warningCount}件</strong><span class="kpi-sub">50%/80%経過措置・特例確認</span></div>
        <div class="batch-kpi-card kpi-red"><span class="kpi-label">番号・形式エラー</span><strong class="kpi-val">${batchStats.formatErrorCount}件</strong><span class="kpi-sub">Modulus 9 チェック不一致</span></div>
      </div>
      ${
        batchStats.usedFallback
          ? '<div class="batch-fallback-notice" role="status"><span>ℹ️</span><span>現在ローカル検証モード（端末内 0.1ms Modulus 9 検査＋サンプル台帳照合）で動作しました。各行の「国税庁 ↗」から公式公表ページを直接開くことも可能です。</span></div>'
          : ''
      }
      <div class="batch-toolbar">
        <div class="batch-filter-pills" role="group" aria-label="結果絞り込み">
          <button type="button" class="filter-pill-btn ${resultFilter === 'all' ? 'active' : ''}" data-filter="all">すべて (${batchStats.totalCount})</button>
          <button type="button" class="filter-pill-btn ${resultFilter === 'valid' ? 'active' : ''}" data-filter="valid">✓ 有効 (${batchStats.validCount})</button>
          <button type="button" class="filter-pill-btn ${resultFilter === 'warning' ? 'active' : ''}" data-filter="warning">⚠️ 要注意 (${batchStats.warningCount})</button>
          <button type="button" class="filter-pill-btn ${resultFilter === 'error' ? 'active' : ''}" data-filter="error">✕ エラー (${batchStats.formatErrorCount})</button>
        </div>
        <div class="batch-toolbar-right">
          <div class="batch-search-box"><span>🔍</span><input id="batchResultSearchInput" type="search" value="${escapeHtml(resultSearch)}" placeholder="商号・T番号・メモで検索" aria-label="検証結果を検索"></div>
          <button type="button" id="copyTsvBtn" class="batch-export-btn">📋 Excel貼付コピー</button>
          <button type="button" id="downloadCsvBtn" class="batch-export-btn btn-export-primary">📥 CSV出力 (UTF-8 BOM)</button>
        </div>
      </div>
      <div class="batch-table-scroll" role="region" aria-label="一括検証結果一覧">
        <table class="batch-result-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">T番号</th>
              <th scope="col">取引日</th>
              <th scope="col">取引日時点判定</th>
              <th scope="col">控除率・税制区分</th>
              <th scope="col">公表商号 ／ メモ</th>
              <th scope="col">詳細・外部照会</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    batchResultsContainer.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        resultFilter = btn.dataset.filter;
        renderBatchResults();
      });
    });

    const searchInput = document.getElementById('batchResultSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        resultSearch = e.target.value;
        const pos = e.target.selectionStart;
        renderBatchResults();
        const fresh = document.getElementById('batchResultSearchInput');
        if (fresh) {
          fresh.focus();
          fresh.setSelectionRange(pos, pos);
        }
      });
    }

    const copyTsvBtn = document.getElementById('copyTsvBtn');
    if (copyTsvBtn) {
      copyTsvBtn.addEventListener('click', () => {
        void copyToClipboard(buildVerifierTsv(filtered), copyTsvBtn, '📋 Excel貼付コピー', '表データ（TSV）');
      });
    }

    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    if (downloadCsvBtn) {
      downloadCsvBtn.addEventListener('click', () => {
        const csv = buildVerifierCsv(batchEntries);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `repit_invoice_verification_${getTodayIsoJst().replace(/-/g, '')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        announce('検証結果CSVをダウンロードしました。');
      });
    }

    batchResultsContainer.querySelectorAll('[data-expand-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.expandId;
        expandedRowId = expandedRowId === id ? null : id;
        renderBatchResults();
      });
    });
  }

  // Initial Boot
  setMode('single');
  updateSingleMicrostatus();
  updateBatchPrecheck();
  renderHistory();
  void runSingleVerify(false);
})();

