BEGIN;
ALTER TABLE users ADD COLUMN instagramUrl TEXT NOT NULL DEFAULT '';
ALTER TABLE achievementDefinitions DROP CONSTRAINT achievementdefinitions_metric_check;
ALTER TABLE achievementDefinitions ADD CONSTRAINT achievementdefinitions_metric_check
  CHECK(metric IN ('participation','hosted','attended','red','pink','purple','gray','pointsEarned','pointsSpent'));
INSERT INTO achievementDefinitions(id,name,description,metric,target) VALUES
('krew-attended-100','번개가 나를 부른다','[크루라이머] 번개 100회 참여','attended',100),
('market-earned-1000','티끌 모아 초크백','[마켓] 포인트 순획득 1,000P 달성','pointsEarned',1000),
('market-earned-5000','포인트가 복사가 된다고','[마켓] 포인트 순획득 5,000P 달성','pointsEarned',5000),
('market-earned-10000','크루의 금고지기','[마켓] 포인트 순획득 10,000P 달성','pointsEarned',10000),
('market-spent-1000','첫 지름의 맛','[마켓] 포인트 실사용 1,000P 달성','pointsSpent',1000),
('market-spent-5000','포인트는 거들 뿐','[마켓] 포인트 실사용 5,000P 달성','pointsSpent',5000),
('market-spent-10000','이 구역 큰손은 나야','[마켓] 포인트 실사용 10,000P 달성','pointsSpent',10000)
ON CONFLICT DO NOTHING;
COMMIT;
