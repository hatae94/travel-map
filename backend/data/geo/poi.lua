-- poi.lua
-- osm2pgsql flex style - 한국 장소 데이터 필터링
-- 이름 / 주소 / 위치(좌표) / 전화번호만 적재

local places = osm2pgsql.define_node_table('places', {
    { column = 'osm_id',           type = 'int8',  not_null = true },
    { column = 'name',             type = 'text' },
    { column = 'name_ko',          type = 'text' },
    { column = 'name_en',          type = 'text' },
    { column = 'category',         type = 'text' },  -- amenity / shop / tourism 등
    { column = 'type',             type = 'text' },  -- cafe / restaurant / hotel 등
    { column = 'phone',            type = 'text' },
    { column = 'addr_full',        type = 'text' },  -- 지번/도로명 전체 주소
    { column = 'addr_province',    type = 'text' },  -- 시/도
    { column = 'addr_city',        type = 'text' },  -- 시/군
    { column = 'addr_district',    type = 'text' },  -- 구/읍/면
    { column = 'addr_suburb',      type = 'text' },  -- 동/리
    { column = 'addr_street',      type = 'text' },  -- 도로명
    { column = 'addr_housenumber', type = 'text' },  -- 건물번호
    { column = 'geom',             type = 'point', projection = 4326, not_null = true },
})

-- 분류 우선순위: 앞에 있을수록 높은 우선순위
local category_keys = {
    'amenity', 'shop', 'tourism', 'leisure',
    'historic', 'office', 'healthcare', 'sport', 'place'
}

local function get_category(tags)
    for _, key in ipairs(category_keys) do
        if tags[key] then
            return key, tags[key]
        end
    end
    return nil, nil
end

local function has_address(tags)
    return tags['addr:full']
        or tags['addr:province']
        or tags['addr:city']
        or tags['addr:district']
        or tags['addr:suburb']
        or tags['addr:street']
end

local function get_phone(tags)
    return tags['phone']
        or tags['contact:phone']
        or tags['contact:mobile']
end

function osm2pgsql.process_node(object)
    local tags = object.tags

    -- 이름 없으면 스킵
    if not tags.name then return end

    local cat, cat_value = get_category(tags)
    local phone = get_phone(tags)

    -- 주소, 전화번호, 또는 분류 중 하나라도 있어야 적재
    if not (has_address(tags) or phone or cat) then return end

    places:insert({
        osm_id           = object.id,
        name             = tags.name,
        name_ko          = tags['name:ko'],
        name_en          = tags['name:en'],
        category         = cat,
        type             = cat_value,
        phone            = phone,
        addr_full        = tags['addr:full'],
        addr_province    = tags['addr:province'],
        addr_city        = tags['addr:city'],
        addr_district    = tags['addr:district'],
        addr_suburb      = tags['addr:suburb'],
        addr_street      = tags['addr:street'],
        addr_housenumber = tags['addr:housenumber'],
        geom             = object:as_point(),
    })
end

-- 면(way)/관계(relation)는 처리하지 않음 (포인트 데이터만 적재)
function osm2pgsql.process_way(object) end
function osm2pgsql.process_relation(object) end
