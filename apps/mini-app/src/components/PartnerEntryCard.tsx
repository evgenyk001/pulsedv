import React from 'react';
import {UsersRound} from 'lucide-react';
import {GroupedMenu,MenuLink} from './GroupedMenu';
export function PartnerEntryCard(){return <GroupedMenu label="Партнёрская программа"><MenuLink to="/partners" tone="green" icon={<UsersRound/>} title="Партнёрская программа" description="Рекомендуйте покупателя и получите вознаграждение"/></GroupedMenu>}
