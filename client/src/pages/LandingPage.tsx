import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher'
import './LandingPage.css'

const LandingPage = () => {
  const { t } = useTranslation();

  return (
    <div className="lp-root">

      <header className="lp-navbar">
        <div className="lp-navbar-logo">
          <span className="lp-diamond">◆</span> {t('brand.name')}
        </div>
        <div className="lp-navbar-right" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
          <LanguageSwitcher />

          <Link to="/login" className="lp-btn-ghost">{t('nav.login')}</Link>
          <Link to="/register" className="lp-btn-red">{t('nav.join')}</Link>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-overlay" />

        <div className="lp-hero-content">
          <div className="lp-divider">
            <span className="lp-divider-line" />
            <span className="lp-diamond accent">◆</span>
            <span className="lp-divider-line" />
          </div>

          <h1 className="lp-title">
            <span className="lp-title-top">{t('brand.titleTop')}</span>
            <span className="lp-title-bottom">{t('brand.titleBottom')}</span>
          </h1>

          <p className="lp-tagline">{t('hero.tagline')}</p>

          <div className="lp-divider">
            <span className="lp-divider-line" />
            <span className="lp-diamond accent">◆</span>
            <span className="lp-divider-line" />
          </div>

          <p className="lp-description">
            {t('hero.desc1')}<br />
            {t('hero.desc2')}
          </p>

          <div className="lp-cta-group">
            <Link to="/register" className="lp-btn-red lp-btn-large">
              ✕ {t('hero.enterBattle')}
            </Link>
            <Link to="/login" className="lp-btn-dark lp-btn-large">
              + {t('hero.createAccount')}
            </Link>
          </div>

          <div className="lp-stats">
            <div className="lp-stat-item">
              <span className="lp-stat-value">3</span>
              <span className="lp-stat-label">{t('hero.stats.factions')}</span>
            </div>
            <div className="lp-stat-divider">◆</div>
            <div className="lp-stat-item">
              <span className="lp-stat-value">100+</span>
              <span className="lp-stat-label">{t('hero.stats.cards')}</span>
            </div>
            <div className="lp-stat-divider">◆</div>
            <div className="lp-stat-item">
              <span className="lp-stat-value">∞</span>
              <span className="lp-stat-label">{t('hero.stats.strategies')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section-header">
          <span className="lp-diamond accent">◆</span>
          <h2 className="lp-section-title">{t('factions.title')}</h2>
        </div>

        <div className="lp-factions">
          <div className="lp-faction-card">
            <div className="lp-faction-top assault-border">
              <span className="lp-faction-icon">⚔️</span>
            </div>
            <div className="lp-faction-body">
              <div className="lp-faction-label assault-label">{t('factions.assault.label')}</div>
              <h3 className="lp-faction-name">{t('factions.assault.name')}</h3>
              <p className="lp-faction-desc">{t('factions.assault.desc')}</p>
              <div className="lp-faction-tags">
                <span className="lp-tag">{t('factions.assault.tag1')}</span>
                <span className="lp-tag">{t('factions.assault.tag2')}</span>
              </div>
            </div>
          </div>

          <div className="lp-faction-card lp-faction-card--featured">
            <div className="lp-faction-featured-badge">{t('factions.precision.badge')}</div>
            <div className="lp-faction-top precision-border">
              <span className="lp-faction-icon">🏹</span>
            </div>
            <div className="lp-faction-body">
              <div className="lp-faction-label precision-label">{t('factions.precision.label')}</div>
              <h3 className="lp-faction-name">{t('factions.precision.name')}</h3>
              <p className="lp-faction-desc">{t('factions.precision.desc')}</p>
              <div className="lp-faction-tags">
                <span className="lp-tag">{t('factions.precision.tag1')}</span>
                <span className="lp-tag">{t('factions.precision.tag2')}</span>
              </div>
            </div>
          </div>

          <div className="lp-faction-card">
            <div className="lp-faction-top arcane-border">
              <span className="lp-faction-icon">🔮</span>
            </div>
            <div className="lp-faction-body">
              <div className="lp-faction-label arcane-label">{t('factions.arcane.label')}</div>
              <h3 className="lp-faction-name">{t('factions.arcane.name')}</h3>
              <p className="lp-faction-desc">{t('factions.arcane.desc')}</p>
              <div className="lp-faction-tags">
                <span className="lp-tag">{t('factions.arcane.tag1')}</span>
                <span className="lp-tag">{t('factions.arcane.tag2')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-section--dark">
        <div className="lp-section-header">
          <span className="lp-diamond accent">◆</span>
          <h2 className="lp-section-title">{t('howToPlay.title')}</h2>
        </div>

        <div className="lp-steps">
          <div className="lp-step">
            <div className="lp-step-num">01</div>
            <h4 className="lp-step-title">{t('howToPlay.step1.title')}</h4>
            <p className="lp-step-desc">{t('howToPlay.step1.desc')}</p>
          </div>
          <div className="lp-step-arrow">▶</div>
          <div className="lp-step">
            <div className="lp-step-num">02</div>
            <h4 className="lp-step-title">{t('howToPlay.step2.title')}</h4>
            <p className="lp-step-desc">{t('howToPlay.step2.desc')}</p>
          </div>
          <div className="lp-step-arrow">▶</div>
          <div className="lp-step">
            <div className="lp-step-num">03</div>
            <h4 className="lp-step-title">{t('howToPlay.step3.title')}</h4>
            <p className="lp-step-desc">{t('howToPlay.step3.desc')}</p>
          </div>
          <div className="lp-step-arrow">▶</div>
          <div className="lp-step">
            <div className="lp-step-num">04</div>
            <h4 className="lp-step-title">{t('howToPlay.step4.title')}</h4>
            <p className="lp-step-desc">{t('howToPlay.step4.desc')}</p>
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
          <h2 className="lp-final-title">{t('final.title')}</h2>
          <p className="lp-final-sub">{t('final.sub')}</p>
          <Link to="/register" className="lp-btn-red lp-btn-large">
            ✕ {t('final.btn')}
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
        <span className="lp-footer-logo">{t('brand.name')}</span>
        <span className="lp-diamond">◆</span>
        <p className="lp-footer-copy">{t('footer.copy')}</p>
      </footer>

    </div>
  )
}

export default LandingPage