import {IconTile} from './IconTile';
import React from 'react';
import {Link} from 'react-router-dom';
import {UsersRound,ChevronRight} from 'lucide-react';
import styles from '../pages/partners.module.css';
export function PartnerEntryCard(){return <Link className={styles.entry} to="/partners"><IconTile><UsersRound size={20}/></IconTile><div><b>Партнёрская программа</b><small>Рекомендуйте покупателя и получите вознаграждение</small></div><ChevronRight size={17}/></Link>}
