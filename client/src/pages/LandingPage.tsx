import { Link } from 'react-router-dom'
import './LandingPage.css'

const LandingPage = () => {
  return (
    <div className="lp-root">

      {/* NAVBAR */}
      <header className="lp-navbar">
        <div className="lp-navbar-logo">
          <span className="lp-diamond">◆</span> TRIAD ARENA
        </div>
        <div className="lp-navbar-right">
          <Link to="/login" className="lp-btn-ghost">LOGIN</Link>
          <Link to="/register" className="lp-btn-red">JOIN NOW</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-overlay" />
        <div className="lp-hero-texture parchment-texture" />

        <div className="lp-hero-content">
          <div className="lp-divider">
            <span className="lp-divider-line" />
            <span className="lp-diamond accent">◆</span>
            <span className="lp-divider-line" />
          </div>

          <h1 className="lp-title">
            <span className="lp-title-top">TRIAD</span>
            <span className="lp-title-bottom">ARENA</span>
          </h1>

          <p className="lp-tagline">RETURN TO DARKNESS</p>

          <div className="lp-divider">
            <span className="lp-divider-line" />
            <span className="lp-diamond accent">◆</span>
            <span className="lp-divider-line" />
          </div>

          <p className="lp-description">
            Три фракции. Бесконечные стратегии.<br />
            Собери колоду. Войди в арену. Докажи своё превосходство.
          </p>

          <div className="lp-cta-group">
            <Link to="/register" className="lp-btn-red lp-btn-large">
              ✕ ENTER BATTLE
            </Link>
            <Link to="/login" className="lp-btn-dark lp-btn-large">
              + CREATE ACCOUNT
            </Link>
          </div>

          <div className="lp-stats">
            <div className="lp-stat-item">
              <span className="lp-stat-value">3</span>
              <span className="lp-stat-label">ФРАКЦИИ</span>
            </div>
            <div className="lp-stat-divider">◆</div>
            <div className="lp-stat-item">
              <span className="lp-stat-value">100+</span>
              <span className="lp-stat-label">КАРТ</span>
            </div>
            <div className="lp-stat-divider">◆</div>
            <div className="lp-stat-item">
              <span className="lp-stat-value">∞</span>
              <span className="lp-stat-label">СТРАТЕГИЙ</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-header">
          <span className="lp-diamond accent">◆</span>
          <h2 className="lp-section-title">CHOOSE YOUR FACTION</h2>
        </div>

        <div className="lp-factions">
          <div className="lp-faction-card">
            <div className="lp-faction-top assault-border">
              <span className="lp-faction-icon">⚔️</span>
            </div>
            <div className="lp-faction-body">
              <div className="lp-faction-label assault-label">ASSAULT</div>
              <h3 className="lp-faction-name">Натиск</h3>
              <p className="lp-faction-desc">
                Сила и агрессия. Сокруши врага до того, как он успеет ответить.
              </p>
              <div className="lp-faction-tags">
                <span className="lp-tag">Агрессия</span>
                <span className="lp-tag">Юниты</span>
              </div>
            </div>
          </div>

          <div className="lp-faction-card lp-faction-card--featured">
            <div className="lp-faction-featured-badge">FEATURED</div>
            <div className="lp-faction-top precision-border">
              <span className="lp-faction-icon">🏹</span>
            </div>
            <div className="lp-faction-body">
              <div className="lp-faction-label precision-label">PRECISION</div>
              <h3 className="lp-faction-name">Точность</h3>
              <p className="lp-faction-desc">
                Контроль и расчёт. Каждый ход — хирургически выверенный удар.
              </p>
              <div className="lp-faction-tags">
                <span className="lp-tag">Контроль</span>
                <span className="lp-tag">Заклинания</span>
              </div>
            </div>
          </div>

          <div className="lp-faction-card">
            <div className="lp-faction-top arcane-border">
              <span className="lp-faction-icon">🔮</span>
            </div>
            <div className="lp-faction-body">
              <div className="lp-faction-label arcane-label">ARCANE</div>
              <h3 className="lp-faction-name">Арканум</h3>
              <p className="lp-faction-desc">
                Тёмная магия. Манипулируй полем и судьбами из тени.
              </p>
              <div className="lp-faction-tags">
                <span className="lp-tag">Магия</span>
                <span className="lp-tag">Комбо</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--dark">
        <div className="lp-section-header">
          <span className="lp-diamond accent">◆</span>
          <h2 className="lp-section-title">HOW TO PLAY</h2>
        </div>

        <div className="lp-steps">
          <div className="lp-step">
            <div className="lp-step-num">01</div>
            <h4 className="lp-step-title">ЗАРЕГИСТРИРУЙСЯ</h4>
            <p className="lp-step-desc">Создай аккаунт и получи стартовую колоду для каждой фракции</p>
          </div>
          <div className="lp-step-arrow">▶</div>
          <div className="lp-step">
            <div className="lp-step-num">02</div>
            <h4 className="lp-step-title">СОБЕРИ КОЛОДУ</h4>
            <p className="lp-step-desc">Используй Deck Builder для создания идеальной колоды из 20 карт</p>
          </div>
          <div className="lp-step-arrow">▶</div>
          <div className="lp-step">
            <div className="lp-step-num">03</div>
            <h4 className="lp-step-title">FIND MATCH</h4>
            <p className="lp-step-desc">Войди в лобби и найди противника в Normal или Ranked режиме</p>
          </div>
          <div className="lp-step-arrow">▶</div>
          <div className="lp-step">
            <div className="lp-step-num">04</div>
            <h4 className="lp-step-title">ПОБЕДИ</h4>
            <p className="lp-step-desc">Разыгрывай карты, управляй маной и сокруши противника</p>
          </div>
        </div>
      </section>

      <section className="lp-final-cta">
        <div className="lp-final-cta-overlay" />
        <div className="lp-final-cta-content">
          <div className="lp-divider">
            <span className="lp-divider-line" />
            <span className="lp-diamond accent">◆</span>
            <span className="lp-divider-line" />
          </div>
          <h2 className="lp-final-title">ГОТОВ К БОЮ?</h2>
          <p className="lp-final-sub">Арена ждёт своего чемпиона</p>
          <Link to="/register" className="lp-btn-red lp-btn-large">
            ✕ НАЧАТЬ СЕЙЧАС
          </Link>
          <div className="lp-divider" style={{ marginTop: '40px' }}>
            <span className="lp-divider-line" />
            <span className="lp-diamond accent">◆</span>
            <span className="lp-divider-line" />
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <span className="lp-diamond">◆</span>
        <span className="lp-footer-logo">TRIAD ARENA</span>
        <span className="lp-diamond">◆</span>
        <p className="lp-footer-copy">© 2026 Triad Arena. All rights reserved.</p>
      </footer>

    </div>
  )
}

export default LandingPage
