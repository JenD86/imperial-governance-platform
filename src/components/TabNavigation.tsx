import { useState } from 'react';
import FactionsTable from './FactionsTable';
import ImperialSecretariat from './ImperialSecretariat';
import FactionalismRegistry from './FactionalismRegistry';
import CourtOfBanishment from './CourtOfBanishment';
import AncestralTemple from './AncestralTemple';
import { ethers } from 'ethers';

interface Tab {
  id: string;
  name: string;
  heading: string;
}

const tabs: Tab[] = [
  { id: 'chancellery', name: 'The Chancellery', heading: 'The Chancellery' },
  { id: 'courtyard', name: 'Inner Courtyard', heading: 'The Inner Courtyard' },
  { id: 'hierarchy', name: 'The Hierarchy', heading: 'The Hierarchy' },
  { id: 'secretariat', name: 'Imperial Secretariat', heading: 'Imperial Secretariat' },
  { id: 'temple', name: 'Ancestral Temple', heading: 'Ancestral Temple' },
];

interface TabNavigationProps {
  provider?: ethers.providers.Web3Provider;
  account?: string;
  children: React.ReactNode;
  lastTransactionHash?: string;
  onTokenBurned?: () => void;
}

export default function TabNavigation({ provider, account, children, lastTransactionHash, onTokenBurned }: TabNavigationProps) {
  const [activeTab, setActiveTab] = useState('chancellery');

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="w-full flex justify-center items-center px-2 pt-2 mx-auto h-16 md:px-4 md:h-auto md:border-b md:flex-row md:w-full md:max-w-7xl border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`font-daobi border pb-2 md:border-0 px-4 box-content w-1/4 text-sm md:text-xl h-full transition-colors duration-200 ${
              activeTab === tab.id
                ? "font-bold text-daobi-orange md:!border-b-2 border-daobi-orange"
                : "font-medium text-gray-600 dark:text-gray-400 hover:text-daobi-orange"
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex flex-col mx-1 mt-2 space-y-2 min-h-screen md:mx-16 xl:mx-32 2xl:mx-64">
        {activeTab === 'chancellery' && (
          <div>
            {children}
          </div>
        )}
        
        {activeTab === 'courtyard' && (
          <div>
            <h2 className="text-2xl font-daobi text-center mb-6">The Inner Courtyard</h2>
            <div className="space-y-8">
              <FactionalismRegistry
                provider={provider}
                account={account}
                voteContract={new ethers.Contract(
                  process.env.NEXT_PUBLIC_VOTE_ADDR!,
                  ['function vote(address _voteFor) external', 'function recluse() external', 'function selfImmolate() external'],
                  provider
                )}
                onTransactionSubmitted={(hash) => console.log('Transaction submitted:', hash)}
                onTokenBurned={onTokenBurned}
              />
              
              <CourtOfBanishment
                provider={provider}
                account={account}
                banishmentContract={new ethers.Contract(
                  process.env.NEXT_PUBLIC_BANISHMENT_ADDR!,
                  [
                    'function makeAccusation(address _target) external',
                    'function banish(address _target) external',
                    'function thirdPartyRefute(address _target) external',
                    'function grudgeBook(address) external view returns (address accuser, uint32 accusationTime, uint256 accBalance, address[] supporters)',
                    'function responseDays() external view returns (uint8)',
                    'function staleDays() external view returns (uint8)',
                    'function minSupporters() external view returns (uint16)',
                    'function idleDays() external view returns (uint8)',
                    'event AccusationMade(address indexed _accuser, address indexed _target)',
                    'event AccusationJoined(address indexed _target, address supporter)',
                    'event Banished(address indexed _accuser, address indexed _target)'
                  ],
                  provider
                )}
                onTransactionSubmitted={(hash) => console.log('Transaction submitted:', hash)}
              />
            </div>
          </div>
        )}
        
        {activeTab === 'hierarchy' && (
          <div>
            <h2 className="text-2xl font-daobi text-center mb-6">The Hierarchy</h2>
            <FactionsTable 
              provider={provider} 
              onDemandUpdate={true}
              lastTransactionHash={lastTransactionHash}
            />
          </div>
        )}
        
        {activeTab === 'secretariat' && (
          <div>
            <ImperialSecretariat />
          </div>
        )}
        
        {activeTab === 'temple' && (
          <div>
            <AncestralTemple
              provider={provider}
              account={account || ''}
              tokenContract={new ethers.Contract(
                process.env.NEXT_PUBLIC_TOKEN_ADDR || '',
                [
                  'function balanceOf(address) external view returns (uint256)', 
                  'function burn(uint256 amount) external',
                  'function transfer(address to, uint256 amount) external returns (bool)'
                ],
                provider
              )}
              onTransactionSubmitted={(hash) => console.log('Transaction submitted:', hash)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
