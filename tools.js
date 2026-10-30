// The free calculators on /tools/<slug>/. One file for both sides: build.js
// requires it to print each tool's first result into the page, and the browser
// runs the same sums as people type. Page copy lives in data/tools.json.

(function () {
  // ── NEPSE charges (the same numbers as the app's CommissionUtils) ──
  const TIERS = [[50000, 0.0036], [500000, 0.0033], [2000000, 0.0031], [10000000, 0.0027], [Infinity, 0.0024]];
  const SEBON = 0.00015, DP = 25, MIN_COMMISSION = 10, DIVIDEND_TAX = 0.05;
  // Capital gains tax on listed shares, in force from 22 Sep 2026.
  const CGT = { short: 0.05, long: 0.0375, inst: 0.10 };
  const CIRCUIT = 0.15;
  // Income tax slabs as [width, rate]. One table for everyone from 2083/84
  // (Finance Act 2083); the old single-person table for comparison. The 1%
  // first band is social security tax, waived for SSF members.
  const TAX_2083 = [[1000000, 0.01], [500000, 0.10], [1000000, 0.20], [1500000, 0.27], [Infinity, 0.29]];
  const TAX_2082 = [[500000, 0.01], [200000, 0.10], [300000, 0.20], [1000000, 0.30], [3000000, 0.36], [Infinity, 0.39]];

  const rate = (amt) => TIERS.find(([max]) => amt <= max)[1];
  const commission = (amt) => (amt > 0 ? Math.max(MIN_COMMISSION, amt * rate(amt)) : 0);
  function fees(amt, dp = true) {
    const c = commission(amt), s = amt * SEBON, d = dp && amt > 0 ? DP : 0;
    return { c, s, d, total: c + s + d };
  }
  const afterSellFees = (units, price) => units * price - fees(units * price).total;

  // Smallest price where f(price) reaches goal (f only goes up with price).
  function solve(f, goal, hi) {
    let lo = 0;
    while (f(hi) < goal) hi *= 2;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) < goal) lo = mid; else hi = mid; }
    return hi;
  }

  // ── Formatting ──
  const fmt = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const rs = (n) => (n < 0 ? '-Rs ' : 'Rs ') + fmt(Math.abs(n));
  const pct = (n, d = 2) => fmt(n * 100, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + '%';
  const signed = (n) => (n > 0 ? '+' : '') + pct(n);
  const lakh = (n) => fmt(n / 100000, n % 100000 ? 1 : 0) + ' lakh';
  const units = (n) => fmt(n, Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);
  const tone = (n) => (n > 0 ? 'up' : n < 0 ? 'dn' : '');
  const taxRate = (held) => CGT[held] || CGT.short;
  const heldLabel = (held) => (held === 'inst' ? 'institution' : held === 'long' ? 'held over 1 year' : 'held 1 year or less');
  const ok = (...n) => n.every((x) => Number.isFinite(x) && x > 0);

  // Each calculator gets the form values and returns
  // { main: [label, value, tone?], rows: [[label, value, tone?]], note? } or null.
  const calcs = {
    share(v) {
      if (!ok(v.units, v.price)) return null;
      if (v.mode === 'sell') {
        if (!ok(v.buy)) return null;
        const amt = v.units * v.price, f = fees(amt);
        const cost = v.units * v.buy + (v.buyFees ? fees(v.units * v.buy).total : 0);
        const gain = amt - f.total - cost, tax = gain > 0 ? gain * taxRate(v.held) : 0;
        return {
          main: ['Cash you receive', rs(amt - f.total - tax)],
          rows: [
            ['Sale amount', rs(amt)],
            [`Broker commission (${pct(rate(amt))})`, rs(f.c)],
            ['SEBON fee (0.015%)', rs(f.s)],
            ['DP charge', rs(f.d)],
            ['What the shares cost you', rs(cost)],
            ['Profit before tax', rs(gain), tone(gain)],
            [`Capital gains tax (${pct(taxRate(v.held))})`, rs(tax)],
            ['Profit after tax', `${rs(gain - tax)} (${signed((gain - tax) / cost)})`, tone(gain - tax)],
          ],
          note: gain <= 0 ? 'No capital gains tax on a loss.' : '',
        };
      }
      const amt = v.units * v.price, f = fees(amt, v.dp);
      return {
        main: ['Total you pay', rs(amt + f.total)],
        rows: [
          ['Share amount', rs(amt)],
          [`Broker commission (${pct(rate(amt))})`, rs(f.c)],
          ['SEBON fee (0.015%)', rs(f.s)],
          ['DP charge', rs(f.d)],
          ['Total fees', rs(f.total)],
          ['Cost per share', rs((amt + f.total) / v.units)],
        ],
      };
    },

    commission(v) {
      if (!ok(v.units, v.price)) return null;
      const amt = v.units * v.price, f = fees(amt);
      return {
        main: ['Broker commission', rs(f.c)],
        rows: [
          ['Trade amount', rs(amt)],
          ['Commission rate', pct(rate(amt))],
          ['SEBON fee (0.015%)', rs(f.s)],
          ['DP charge', rs(f.d)],
          ['Total fees', rs(f.total)],
          ['Fees as a share of the trade', pct(f.total / amt)],
        ],
        note: f.c === MIN_COMMISSION ? 'Small trade: the Rs 10 minimum commission applies.' : '',
      };
    },

    cgt(v) {
      if (!ok(v.units, v.buy, v.price)) return null;
      const got = afterSellFees(v.units, v.price);
      const cost = v.units * v.buy + fees(v.units * v.buy).total;
      const gain = got - cost, r = taxRate(v.held), tax = gain > 0 ? gain * r : 0;
      return {
        main: ['Capital gains tax', rs(tax)],
        rows: [
          ['Sale amount after fees', rs(got)],
          ['Buying cost with fees', rs(cost)],
          ['Profit before tax', rs(gain), tone(gain)],
          [`Tax rate (${heldLabel(v.held)})`, pct(r)],
          ['Profit after tax', rs(gain - tax), tone(gain - tax)],
        ],
        note: gain <= 0 ? 'You made a loss, so there is no tax to pay.' : '',
      };
    },

    breakeven(v) {
      if (!ok(v.units, v.buy)) return null;
      const cost = v.units * v.buy + fees(v.units * v.buy).total;
      const p = solve((x) => afterSellFees(v.units, x), cost, v.buy * 2);
      return {
        main: ['Break-even sell price', rs(p)],
        rows: [
          ['Your buy price', rs(v.buy)],
          ['Total buying cost', rs(cost)],
          ['Price rise needed', signed(p / v.buy - 1)],
          ['Fees to buy and sell', rs(v.units * p - afterSellFees(v.units, p) + cost - v.units * v.buy)],
        ],
        note: 'Sell above this price and you make a profit.',
      };
    },

    target(v) {
      if (!ok(v.units, v.buy, v.goal)) return null;
      const cost = v.units * v.buy + fees(v.units * v.buy).total, r = taxRate(v.held);
      const goal = v.goalType === 'rs' ? v.goal : cost * v.goal / 100;
      const net = (x) => { const g = afterSellFees(v.units, x) - cost; return g > 0 ? g * (1 - r) : g; };
      const p = solve(net, goal, v.buy * 2), got = afterSellFees(v.units, p), tax = (got - cost) * r;
      return {
        main: ['Sell at', rs(p)],
        rows: [
          ['Price rise needed', signed(p / v.buy - 1)],
          ['Cash you receive', rs(got - tax)],
          [`Capital gains tax (${pct(r)})`, rs(tax)],
          ['Profit after tax', rs(goal), 'up'],
        ],
      };
    },

    wacc(v) {
      const rows = (v.lots || []).filter((l) => ok(l.units, l.price));
      if (!rows.length) return null;
      let shares = 0, cost = 0;
      for (const l of rows) {
        shares += l.units;
        cost += l.units * l.price + (l.type === 'buy' && v.buyFees ? fees(l.units * l.price).total : 0);
      }
      return {
        main: ['Your WACC', rs(cost / shares)],
        rows: [
          ['Total shares', units(shares)],
          ['Total cost', rs(cost)],
          ['Purchases counted', String(rows.length)],
        ],
      };
    },

    average(v) {
      if (!ok(v.units, v.avg, v.price)) return null;
      if (v.mode === 'check') {
        if (!ok(v.more)) return null;
        const total = v.units + v.more, avg = (v.units * v.avg + v.more * v.price) / total;
        return {
          main: ['New average price', rs(avg)],
          rows: [
            ['Total shares', units(total)],
            ['Money for the new shares', rs(v.more * v.price)],
            ['Change in average', `${rs(avg - v.avg)} (${signed(avg / v.avg - 1)})`, tone(v.avg - avg)],
          ],
          note: 'Broker fees are not included here.',
        };
      }
      if (!ok(v.goal)) return null;
      const lo = Math.min(v.price, v.avg), hi = Math.max(v.price, v.avg);
      if (!(v.goal > lo && v.goal < hi)) {
        return { main: ['Shares to buy', '-'], rows: [], note: 'Your target average must be between the new buy price and your current average.' };
      }
      const n = Math.ceil(v.units * (v.avg - v.goal) / (v.goal - v.price));
      return {
        main: ['Shares to buy', units(n)],
        rows: [
          ['Money needed', rs(n * v.price)],
          ['Total shares after', units(v.units + n)],
          ['New average price', rs((v.units * v.avg + n * v.price) / (v.units + n))],
        ],
        note: 'Broker fees are not included here.',
      };
    },

    bonus(v) {
      if (!ok(v.price, v.bonus)) return null;
      const adj = v.price / (1 + v.bonus / 100), got = (v.units || 0) * v.bonus / 100;
      return {
        main: ['Price after bonus', rs(adj)],
        rows: [
          ['Price before book close', rs(v.price)],
          ['Price drop', signed(adj / v.price - 1)],
          ...(v.units > 0 ? [
            ['Bonus shares you get', units(got)],
            ['Shares after bonus', units(v.units + got)],
            ['Value before and after', rs(v.units * v.price)],
          ] : []),
        ],
      };
    },

    right(v) {
      if (!ok(v.price, v.right, v.rightPrice)) return null;
      const r = v.right / 100, adj = (v.price + r * v.rightPrice) / (1 + r), get = (v.units || 0) * r;
      return {
        main: ['Price after right shares', rs(adj)],
        rows: [
          ['Price before book close', rs(v.price)],
          ['Price change', signed(adj / v.price - 1), tone(adj - v.price)],
          ...(v.units > 0 ? [
            ['Right shares you can apply for', units(get)],
            ['Cost to apply', rs(get * v.rightPrice)],
            ['Shares after', units(v.units + get)],
          ] : []),
        ],
      };
    },

    dividend(v) {
      if (!ok(v.units, v.face) || !(v.cash > 0 || v.bonus > 0)) return null;
      const cash = v.units * v.face * (v.cash || 0) / 100;
      const bonusShares = v.units * (v.bonus || 0) / 100;
      const tax = (cash + bonusShares * v.face) * DIVIDEND_TAX;
      const net = cash - tax;
      return {
        main: ['Cash in your bank', rs(Math.max(0, net))],
        rows: [
          ['Cash dividend before tax', rs(cash)],
          ['Bonus shares', units(bonusShares)],
          ['Tax (5% of cash and bonus)', rs(tax)],
          ...(v.price > 0 ? [['Dividend yield (cash)', pct(v.face * (v.cash || 0) / 100 / v.price)]] : []),
        ],
        note: net < 0 ? 'The cash part is too small to cover the tax. The rest is usually collected before the bonus shares reach you.' : '',
      };
    },

    riskreward(v) {
      if (!ok(v.entry, v.stop, v.target)) return null;
      if (!(v.stop < v.entry && v.target > v.entry)) {
        return { main: ['Risk reward ratio', '-'], rows: [], note: 'For a buy, the stop loss must be below your entry and the target above it.' };
      }
      const risk = v.entry - v.stop, reward = v.target - v.entry, ratio = reward / risk;
      return {
        main: ['Risk reward ratio', `1 : ${fmt(ratio)}`, ratio >= 1 ? 'up' : 'dn'],
        rows: [
          ['Risk per share', `${rs(risk)} (${signed(-risk / v.entry)})`, 'dn'],
          ['Reward per share', `${rs(reward)} (${signed(reward / v.entry)})`, 'up'],
          ['Wins needed to break even', pct(1 / (1 + ratio), 0)],
        ],
        note: 'Many traders want the reward to be at least twice the risk.',
      };
    },

    position(v) {
      if (!ok(v.capital, v.risk, v.entry, v.stop)) return null;
      if (!(v.stop < v.entry)) return { main: ['Shares to buy', '-'], rows: [], note: 'The stop loss must be below your entry price.' };
      const atRisk = v.capital * v.risk / 100, perShare = v.entry - v.stop;
      const byRisk = Math.floor(atRisk / perShare), byCash = Math.floor(v.capital / v.entry), n = Math.min(byRisk, byCash);
      return {
        main: ['Shares to buy', units(n)],
        rows: [
          ['Money you are willing to lose', rs(atRisk)],
          ['Risk per share', rs(perShare)],
          ['Trade amount', rs(n * v.entry)],
          ['Share of your capital', pct(n * v.entry / v.capital)],
          ['Loss if the stop is hit', rs(n * perShare), 'dn'],
        ],
        note: byCash < byRisk ? 'Limited by your capital, not by your risk.' : '',
      };
    },

    circuit(v) {
      if (!ok(v.close)) return null;
      const days = Math.min(10, Math.max(1, Math.round(v.days || 1)));
      const rows = [];
      for (let d = 1; d <= days; d++) rows.push([`Day ${d}: lowest to highest`, `${rs(v.close * (1 - CIRCUIT) ** d)} to ${rs(v.close * (1 + CIRCUIT) ** d)}`]);
      return {
        main: ['Highest price today', rs(v.close * (1 + CIRCUIT)), 'up'],
        rows: [['Lowest price today', rs(v.close * (1 - CIRCUIT)), 'dn'], ...(days > 1 ? rows : [])],
        note: days > 1 ? 'Each day counts from the day before, if the stock hits its limit every day.' : '',
      };
    },

    pivot(v) {
      if (!ok(v.high, v.low, v.close) || v.low > v.high) return null;
      const p = (v.high + v.low + v.close) / 3, range = v.high - v.low;
      return {
        main: ['Pivot point', rs(p)],
        rows: [
          ['Resistance 3', rs(v.high + 2 * (p - v.low)), 'up'],
          ['Resistance 2', rs(p + range), 'up'],
          ['Resistance 1', rs(2 * p - v.low), 'up'],
          ['Support 1', rs(2 * p - v.high), 'dn'],
          ['Support 2', rs(p - range), 'dn'],
          ['Support 3', rs(v.low - 2 * (v.high - p)), 'dn'],
        ],
      };
    },

    fibonacci(v) {
      if (!ok(v.high, v.low) || v.low >= v.high) return null;
      const range = v.high - v.low, up = v.trend !== 'down';
      const level = (r) => (up ? v.high - range * r : v.low + range * r);
      return {
        main: ['61.8% level', rs(level(0.618))],
        rows: [
          ...[0.236, 0.382, 0.5, 0.618, 0.786].map((r) => [`${pct(r, 1)} level`, rs(level(r))]),
          [up ? 'Target if it breaks the high (161.8%)' : 'Target if it breaks the low (161.8%)', rs(up ? v.low + range * 1.618 : v.high - range * 1.618), up ? 'up' : 'dn'],
        ],
      };
    },

    sip(v) {
      if (!ok(v.years) || !(v.rate >= 0)) return null;
      const n = Math.round(v.years * 12), r = v.rate / 1200;
      // What Rs 1 a month grows to, paid at the start of each month.
      const per = r ? ((1 + r) ** n - 1) / r * (1 + r) : n;
      const yrs = fmt(v.years, v.years % 1 ? 1 : 0);
      if (v.mode === 'goal') {
        if (!ok(v.goal)) return null;
        const monthly = v.goal / per;
        return {
          main: ['Put in every month', rs(monthly)],
          rows: [
            ['Your goal', rs(v.goal)],
            ['You put in', rs(monthly * n)],
            ['Growth', rs(v.goal - monthly * n), tone(v.goal - monthly * n)],
          ],
          note: 'Returns are not guaranteed. This only shows what a steady return would do.',
        };
      }
      if (!ok(v.monthly)) return null;
      const value = v.monthly * per, put = v.monthly * n;
      return {
        main: [`Value after ${yrs} years`, rs(value)],
        rows: [
          ['You put in', rs(put)],
          ['Growth', rs(value - put), tone(value - put)],
          ['Growth as a share of the value', pct((value - put) / value)],
        ],
        note: 'Returns are not guaranteed. This only shows what a steady return would do.',
      };
    },

    tax(v) {
      if (!ok(v.salary)) return null;
      const income = v.period === 'year' ? v.salary : v.salary * 12;
      const taxable = Math.max(0, income - (v.deductions || 0));
      const slabs = (bands) => {
        let left = taxable, from = 0;
        return bands.map(([width, r], i) => {
          const part = Math.max(0, Math.min(left, width));
          left -= part;
          const rate = i === 0 && v.ssf ? 0 : r, row = { from, to: from + width, rate, part, tax: part * rate };
          from += width;
          return row;
        });
      };
      const now = slabs(TAX_2083), before = slabs(TAX_2082);
      const tax = now.reduce((a, b) => a + b.tax, 0), old = before.reduce((a, b) => a + b.tax, 0);
      const band = (b) => (b.to === Infinity ? `Above Rs ${lakh(b.from)}` : b.from ? `Rs ${lakh(b.from)} to ${lakh(b.to)}` : `Up to Rs ${lakh(b.to)}`);
      return {
        main: ['Income tax per year', rs(tax)],
        rows: [
          ['Taxable income', rs(taxable)],
          ...now.filter((b) => b.part > 0).map((b) => [`${band(b)} at ${pct(b.rate)}`, rs(b.tax)]),
          ['Tax per month', rs(tax / 12)],
          ['Salary after tax, per month', rs((income - tax) / 12)],
          ['Effective tax rate', pct(income ? tax / income : 0)],
          ['Tax on last year\'s slabs (2082/83, single)', rs(old)],
          [tax <= old ? 'You save this year' : 'You pay more this year', rs(Math.abs(old - tax)), tax <= old ? 'up' : 'dn'],
        ],
      };
    },

    emi(v) {
      if (!ok(v.loan, v.years) || !(v.rate >= 0)) return null;
      const n = Math.round(v.years * 12), r = v.rate / 1200;
      const emi = r ? v.loan * r * (1 + r) ** n / ((1 + r) ** n - 1) : v.loan / n, paid = emi * n;
      return {
        main: ['Monthly payment (EMI)', rs(emi)],
        rows: [
          ['Loan amount', rs(v.loan)],
          ['Total interest', rs(paid - v.loan), 'dn'],
          ['Total you pay back', rs(paid)],
          ['Interest as a share of what you pay', pct((paid - v.loan) / paid)],
        ],
      };
    },

    fd(v) {
      if (!ok(v.amount, v.years) || !(v.rate >= 0)) return null;
      const m = Number(v.every) || 4, value = v.amount * (1 + v.rate / 100 / m) ** (m * v.years);
      return {
        main: ['Amount at maturity', rs(value)],
        rows: [
          ['You deposit', rs(v.amount)],
          ['Interest earned', rs(value - v.amount), 'up'],
          ['Effective yearly rate', pct((1 + v.rate / 100 / m) ** m - 1)],
        ],
        note: 'Banks take tax on interest before paying it. Check the rate with your bank.',
      };
    },

    rd(v) {
      if (!ok(v.monthly, v.years) || !(v.rate >= 0)) return null;
      const n = Math.round(v.years * 12), q = v.rate / 400;
      // Each deposit earns interest added every three months, for the months it stays in.
      let value = 0;
      for (let k = 0; k < n; k++) value += v.monthly * (1 + q) ** ((n - k) / 3);
      const put = v.monthly * n;
      return {
        main: ['Amount at maturity', rs(value)],
        rows: [
          ['You deposit', rs(put)],
          ['Interest earned', rs(value - put), 'up'],
          ['Number of deposits', String(n)],
        ],
        note: 'Banks take tax on interest before paying it. Check the rate with your bank.',
      };
    },

    returns(v) {
      if (!ok(v.buy, v.price, v.years)) return null;
      const end = v.price + (v.dividends || 0), total = end / v.buy - 1, cagr = (end / v.buy) ** (1 / v.years) - 1;
      return {
        main: ['Yearly return (CAGR)', signed(cagr), tone(cagr)],
        rows: [
          ['Total return', signed(total), tone(total)],
          ['Gain per share', rs(end - v.buy), tone(end - v.buy)],
          ...(v.dividends > 0 ? [['From dividends', rs(v.dividends)]] : []),
        ],
      };
    },

    pe(v) {
      if (!ok(v.price) || !Number.isFinite(v.eps) || v.eps === 0) return null;
      if (v.eps < 0) return { main: ['PE ratio', 'Loss-making'], rows: v.bvps > 0 ? [['PB ratio', fmt(v.price / v.bvps)]] : [], note: 'PE has no meaning when the company makes a loss.' };
      return {
        main: ['PE ratio', fmt(v.price / v.eps)],
        rows: [
          ['You pay for Rs 1 of yearly profit', rs(v.price / v.eps)],
          ['Earnings yield', pct(v.eps / v.price)],
          ...(v.bvps > 0 ? [['PB ratio', fmt(v.price / v.bvps)]] : []),
        ],
      };
    },

    graham(v) {
      if (!ok(v.eps, v.bvps)) return { main: ['Graham number', '-'], rows: [], note: 'It only works when both EPS and book value are above zero.' };
      const g = Math.sqrt(22.5 * v.eps * v.bvps);
      return {
        main: ['Graham number', rs(g)],
        rows: v.price > 0 ? [
          ['Market price', rs(v.price)],
          [v.price < g ? 'Price is below the Graham number by' : 'Price is above the Graham number by', pct(Math.abs(v.price / g - 1)), v.price < g ? 'up' : 'dn'],
        ] : [],
      };
    },
  };

  const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function resultHtml(r) {
    if (!r) return '<p class="tl-empty">Enter your numbers to see the result.</p>';
    const [label, value, t] = r.main;
    return `<p class="tl-main-l">${escape(label)}</p><p class="tl-main n${t ? ' ' + t : ''}">${escape(value)}</p>` +
      (r.rows.length ? `<dl class="tl-rows">${r.rows.map(([k, val, rt]) => `<div><dt>${escape(k)}</dt><dd class="n${rt ? ' ' + rt : ''}">${escape(val)}</dd></div>`).join('')}</dl>` : '') +
      (r.note ? `<p class="tl-note">${escape(r.note)}</p>` : '');
  }

  const api = { calcs, resultHtml, fees, rate, CGT, CIRCUIT };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ── In the browser ──
  const num = (s) => { const n = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };

  function values(form) {
    const v = {};
    form.querySelectorAll('[data-seg]').forEach((seg) => { v[seg.dataset.seg] = seg.querySelector('[aria-pressed="true"]').dataset.v; });
    form.querySelectorAll('input[name], select[name]').forEach((el) => {
      if (el.closest('[data-lots]')) return;
      v[el.name] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : num(el.value);
    });
    form.querySelectorAll('[data-lots]').forEach((box) => {
      v[box.dataset.lots] = [...box.querySelectorAll('.tl-lot')].map((row) => ({
        type: row.querySelector('select').value, units: num(row.querySelector('[data-k="units"]').value), price: num(row.querySelector('[data-k="price"]').value),
      }));
    });
    return v;
  }

  function bind(form) {
    const calc = calcs[form.dataset.tool], out = form.querySelector('[data-out]');
    const update = () => {
      const v = values(form);
      form.querySelectorAll('[data-when]').forEach((el) => {
        const [k, want] = el.dataset.when.split('=');
        el.hidden = String(v[k]) !== want;
      });
      out.innerHTML = resultHtml(calc(v));
    };
    form.addEventListener('input', update);
    form.addEventListener('change', (e) => {
      // IPO and bonus shares are counted at Rs 100 each.
      if (e.target.matches('.tl-lot select') && e.target.value !== 'buy') e.target.closest('.tl-lot').querySelector('[data-k="price"]').value = 100;
      update();
    });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.parentElement.dataset.seg) {
        b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      } else if (b.dataset.add) {
        const box = form.querySelector(`[data-lots="${b.dataset.add}"]`), row = box.querySelector('.tl-lot').cloneNode(true);
        row.removeAttribute('data-orig');
        row.querySelectorAll('input').forEach((i) => { i.value = ''; });
        row.querySelector('select').value = 'buy';
        box.append(row);
        row.querySelector('input').focus();
      } else if (b.dataset.remove !== undefined) {
        const box = b.closest('[data-lots]');
        if (box.querySelectorAll('.tl-lot').length > 1) b.closest('.tl-lot').remove();
        else b.closest('.tl-lot').querySelectorAll('input').forEach((i) => { i.value = ''; });
      } else return;
      update();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('reset', () => setTimeout(() => {
      form.querySelectorAll('[data-seg] button').forEach((x) => x.setAttribute('aria-pressed', String(x.hasAttribute('data-default'))));
      form.querySelectorAll('.tl-lot:not([data-orig])').forEach((row) => row.remove());
      update();
    }));
    update();
  }

  document.querySelectorAll('form[data-tool]').forEach(bind);
})();
